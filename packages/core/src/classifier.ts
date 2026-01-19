/**
 * Solvent - Account Classifier
 * 
 * Classifies sponsored accounts as RECLAIMABLE or MONITOR_ONLY
 * based on their close_authority and current state.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, Account } from '@solana/spl-token';
import type {
    Network,
    SponsoredAccount,
    AccountClassification,
    AccountType,
    AccountStatus
} from './types.js';
import { getConnection, ESTIMATED_RENT, lamportsToSol } from './config.js';
import type { ParsedAccountCreation } from './scanner.js';

/**
 * Get detailed info about a token account
 */
async function getTokenAccountInfo(
    connection: Connection,
    address: string
): Promise<Account | null> {
    try {
        const pubkey = new PublicKey(address);
        return await getAccount(connection, pubkey);
    } catch (e) {
        return null;
    }
}

/**
 * Classify a single account
 */
export async function classifyAccount(
    creation: ParsedAccountCreation,
    feePayerAddress: string,
    network: Network
): Promise<SponsoredAccount> {
    const connection = getConnection(network);
    const feePayerLower = feePayerAddress.toLowerCase();

    // Default values
    let closeAuthority: string | null = null;
    let tokenBalance = 0;
    let rentLamports = creation.lamports || ESTIMATED_RENT.TOKEN_ACCOUNT * 1_000_000_000;
    let status: AccountStatus = 'ACTIVE';
    let type: AccountType = 'UNKNOWN';

    // Try to get account info
    const accountInfo = await connection.getAccountInfo(new PublicKey(creation.account));

    if (!accountInfo) {
        // Account no longer exists (closed)
        status = 'CLOSED';
        return {
            address: creation.account,
            type: creation.type === 'CreateAssociatedTokenAccount' ? 'ATA' : 'SYSTEM',
            owner: creation.owner,
            closeAuthority: null,
            mint: creation.mint,
            rentLamports: rentLamports,
            tokenBalance: 0,
            classification: 'MONITOR_ONLY',
            status: 'CLOSED',
            creationSignature: creation.signature,
            createdAt: creation.blockTime ? new Date(creation.blockTime * 1000) : new Date()
        };
    }

    // Get rent from actual account
    rentLamports = accountInfo.lamports;

    // Check if it's a token account
    if (creation.type === 'CreateAssociatedTokenAccount' || creation.mint) {
        type = 'ATA';

        const tokenInfo = await getTokenAccountInfo(connection, creation.account);
        if (tokenInfo) {
            tokenBalance = Number(tokenInfo.amount);
            closeAuthority = tokenInfo.closeAuthority?.toBase58() || null;

            // If no explicit close authority, it defaults to owner
            if (!closeAuthority) {
                closeAuthority = tokenInfo.owner.toBase58();
            }
        }
    } else {
        type = 'SYSTEM';
    }

    // Determine if closeable (balance = 0)
    if (tokenBalance === 0) {
        status = 'CLOSEABLE';
    }

    // Classify: Can fee payer close this account?
    let classification: AccountClassification = 'MONITOR_ONLY';

    if (closeAuthority) {
        // Check if close authority matches fee payer
        if (closeAuthority.toLowerCase() === feePayerLower) {
            classification = 'RECLAIMABLE';
        }
    }

    // Also reclaimable if fee payer owns the account directly
    if (creation.owner.toLowerCase() === feePayerLower) {
        classification = 'RECLAIMABLE';
    }

    return {
        address: creation.account,
        type,
        owner: creation.owner,
        closeAuthority,
        mint: creation.mint,
        rentLamports,
        tokenBalance,
        classification,
        status,
        creationSignature: creation.signature,
        createdAt: creation.blockTime ? new Date(creation.blockTime * 1000) : new Date()
    };
}

/**
 * Classify multiple accounts
 */
export async function classifyAccounts(
    creations: ParsedAccountCreation[],
    feePayerAddress: string,
    network: Network
): Promise<SponsoredAccount[]> {
    console.log(`Classifying ${creations.length} accounts...`);

    const accounts: SponsoredAccount[] = [];
    let processed = 0;

    for (const creation of creations) {
        try {
            const account = await classifyAccount(creation, feePayerAddress, network);
            accounts.push(account);
            processed++;

            if (processed % 10 === 0) {
                const reclaimable = accounts.filter(a => a.classification === 'RECLAIMABLE').length;
                console.log(`  Classified ${processed}/${creations.length} (${reclaimable} reclaimable)`);
            }

            // Rate limiting
            await new Promise(r => setTimeout(r, 100));
        } catch (e) {
            console.error(`  Failed to classify ${creation.account}: ${e}`);
        }
    }

    const reclaimable = accounts.filter(a => a.classification === 'RECLAIMABLE').length;
    const closeable = accounts.filter(a => a.status === 'CLOSEABLE').length;

    console.log(`\nClassification complete:`);
    console.log(`  Total: ${accounts.length}`);
    console.log(`  Reclaimable: ${reclaimable}`);
    console.log(`  Closeable (balance=0): ${closeable}`);

    return accounts;
}
