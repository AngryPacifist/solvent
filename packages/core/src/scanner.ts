/**
 * Solvent - Transaction Scanner
 * 
 * Scans a fee payer's transaction history to find sponsored account creations.
 */

import {
    Connection,
    PublicKey,
    ParsedTransactionWithMeta,
    ConfirmedSignatureInfo
} from '@solana/web3.js';
import type { Network, ScanOptions } from './types.js';
import { getConnection } from './config.js';

// Maximum signatures to fetch per request
const BATCH_SIZE = 100;

// Program IDs we're looking for
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

export interface TransactionInfo {
    signature: string;
    blockTime: number | null | undefined;
    slot: number;
    err: any | null;
}

export interface ParsedAccountCreation {
    /** The created account address */
    account: string;

    /** Who paid for the account (should be fee payer) */
    payer: string;

    /** Account owner */
    owner: string;

    /** Token mint (for ATAs) */
    mint: string | null;

    /** Type of creation instruction */
    type: 'CreateAccount' | 'CreateAssociatedTokenAccount' | 'InitializeAccount';

    /** Transaction signature */
    signature: string;

    /** Block time */
    blockTime: number | null | undefined;

    /** Lamports transferred for rent */
    lamports: number;
}

/**
 * Scan a fee payer's transaction history
 */
export async function scanFeePayerHistory(
    feePayerAddress: string,
    network: Network,
    options: ScanOptions = {}
): Promise<TransactionInfo[]> {
    const connection = getConnection(network);
    const feePayer = new PublicKey(feePayerAddress);

    const limit = options.limit || 1000;
    const allSignatures: ConfirmedSignatureInfo[] = [];
    let lastSignature: string | undefined;

    console.log(`Scanning transaction history for ${feePayerAddress}...`);

    while (allSignatures.length < limit) {
        const batchLimit = Math.min(BATCH_SIZE, limit - allSignatures.length);

        const signatures = await connection.getSignaturesForAddress(
            feePayer,
            {
                limit: batchLimit,
                before: lastSignature
            }
        );

        if (signatures.length === 0) break;

        allSignatures.push(...signatures);
        lastSignature = signatures[signatures.length - 1].signature;

        console.log(`  Fetched ${allSignatures.length} signatures...`);

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`Found ${allSignatures.length} total transactions`);

    return allSignatures.map(sig => ({
        signature: sig.signature,
        blockTime: sig.blockTime,
        slot: sig.slot,
        err: sig.err
    }));
}

/**
 * Fetch and parse a transaction to find account creations
 */
export async function parseTransaction(
    signature: string,
    feePayerAddress: string,
    network: Network
): Promise<ParsedAccountCreation[]> {
    const connection = getConnection(network);

    const tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0
    });

    if (!tx || !tx.meta) return [];

    const creations: ParsedAccountCreation[] = [];
    const feePayer = feePayerAddress.toLowerCase();

    // Check if this transaction's fee payer matches
    const txFeePayer = tx.transaction.message.accountKeys[0].pubkey.toBase58();
    if (txFeePayer.toLowerCase() !== feePayer) {
        return [];
    }

    // Look through instructions for account creations
    for (const ix of tx.transaction.message.instructions) {
        if ('parsed' in ix && ix.parsed) {
            const parsed = ix.parsed;

            // System Program: CreateAccount
            if (ix.program === 'system' && parsed.type === 'createAccount') {
                creations.push({
                    account: parsed.info.newAccount,
                    payer: parsed.info.source,
                    owner: parsed.info.owner,
                    mint: null,
                    type: 'CreateAccount',
                    signature,
                    blockTime: tx.blockTime,
                    lamports: parsed.info.lamports
                });
            }

            // Associated Token Program: Create
            if (ix.program === 'spl-associated-token-account' && parsed.type === 'create') {
                creations.push({
                    account: parsed.info.account,
                    payer: parsed.info.source,
                    owner: parsed.info.wallet,
                    mint: parsed.info.mint,
                    type: 'CreateAssociatedTokenAccount',
                    signature,
                    blockTime: tx.blockTime,
                    lamports: 0 // Will be calculated from rent
                });
            }
        }
    }

    // Also check inner instructions
    if (tx.meta.innerInstructions) {
        for (const inner of tx.meta.innerInstructions) {
            for (const ix of inner.instructions) {
                if ('parsed' in ix && ix.parsed) {
                    const parsed = ix.parsed;

                    if (ix.program === 'system' && parsed.type === 'createAccount') {
                        // Check if already added
                        const exists = creations.some(c => c.account === parsed.info.newAccount);
                        if (!exists) {
                            creations.push({
                                account: parsed.info.newAccount,
                                payer: parsed.info.source,
                                owner: parsed.info.owner,
                                mint: null,
                                type: 'CreateAccount',
                                signature,
                                blockTime: tx.blockTime,
                                lamports: parsed.info.lamports
                            });
                        }
                    }
                }
            }
        }
    }

    return creations;
}

/**
 * Scan and parse all transactions for a fee payer
 */
export async function scanAndParseAccounts(
    feePayerAddress: string,
    network: Network,
    options: ScanOptions = {}
): Promise<ParsedAccountCreation[]> {
    // Get transaction history
    const transactions = await scanFeePayerHistory(feePayerAddress, network, options);

    // Filter out failed transactions
    const successfulTxs = transactions.filter(tx => !tx.err);
    console.log(`Parsing ${successfulTxs.length} successful transactions...`);

    const allCreations: ParsedAccountCreation[] = [];
    let processed = 0;

    for (const tx of successfulTxs) {
        try {
            const creations = await parseTransaction(tx.signature, feePayerAddress, network);
            allCreations.push(...creations);
            processed++;

            if (processed % 10 === 0) {
                console.log(`  Parsed ${processed}/${successfulTxs.length} transactions, found ${allCreations.length} account creations`);
            }

            // Rate limiting
            await new Promise(r => setTimeout(r, 50));
        } catch (e) {
            // Skip failed parses
            console.error(`  Failed to parse ${tx.signature}: ${e}`);
        }
    }

    console.log(`\nFound ${allCreations.length} total account creations`);
    return allCreations;
}
