/**
 * Solvent - Rent Reclaimer
 * 
 * Executes close account transactions to reclaim rent.
 */

import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    sendAndConfirmTransaction
} from '@solana/web3.js';
import { createCloseAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { SponsoredAccount, ReclaimResult, ReclaimOptions, Network } from './types.js';
import { getConnection, lamportsToSol } from './config.js';

/**
 * Close a single account and reclaim rent
 */
export async function closeAccount(
    account: SponsoredAccount,
    keypair: Keypair,
    network: Network,
    destination?: string
): Promise<ReclaimResult> {
    const connection = getConnection(network);
    const accountPubkey = new PublicKey(account.address);
    const destPubkey = destination ? new PublicKey(destination) : keypair.publicKey;

    // Verify account is reclaimable
    if (account.classification !== 'RECLAIMABLE') {
        return {
            account: account.address,
            success: false,
            rentReclaimed: 0,
            signature: null,
            error: 'Account is not reclaimable (close_authority is not fee payer)',
            timestamp: new Date()
        };
    }

    // Verify balance is zero
    if (account.tokenBalance > 0) {
        return {
            account: account.address,
            success: false,
            rentReclaimed: 0,
            signature: null,
            error: `Account has non-zero balance: ${account.tokenBalance}`,
            timestamp: new Date()
        };
    }

    try {
        // Create close instruction
        const closeIx = createCloseAccountInstruction(
            accountPubkey,
            destPubkey,     // Rent destination
            keypair.publicKey, // Authority (close_authority)
            [],
            TOKEN_PROGRAM_ID
        );

        const tx = new Transaction().add(closeIx);
        tx.feePayer = keypair.publicKey;

        // Send and confirm
        const signature = await sendAndConfirmTransaction(
            connection,
            tx,
            [keypair]
        );

        return {
            account: account.address,
            success: true,
            rentReclaimed: lamportsToSol(account.rentLamports),
            signature,
            error: null,
            timestamp: new Date()
        };

    } catch (e: any) {
        return {
            account: account.address,
            success: false,
            rentReclaimed: 0,
            signature: null,
            error: e.message || String(e),
            timestamp: new Date()
        };
    }
}

/**
 * Reclaim rent from multiple accounts
 */
export async function reclaimRent(
    accounts: SponsoredAccount[],
    keypair: Keypair,
    network: Network,
    options: ReclaimOptions = {}
): Promise<ReclaimResult[]> {
    const { dryRun = false, batchSize = 10, destination } = options;

    // Filter to only reclaimable + closeable accounts
    const reclaimable = accounts.filter(
        a => a.classification === 'RECLAIMABLE' &&
            a.status === 'CLOSEABLE' &&
            a.tokenBalance === 0
    );

    if (reclaimable.length === 0) {
        console.log('No accounts available for reclaim');
        return [];
    }

    console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Reclaiming rent from ${reclaimable.length} accounts...`);

    const results: ReclaimResult[] = [];
    const toProcess = reclaimable.slice(0, batchSize);

    for (const account of toProcess) {
        const rentSol = lamportsToSol(account.rentLamports);

        if (dryRun) {
            // Dry run - just log what would happen
            console.log(`  [DRY RUN] Would close ${account.address.slice(0, 8)}... → ${rentSol.toFixed(6)} SOL`);
            results.push({
                account: account.address,
                success: true,
                rentReclaimed: rentSol,
                signature: null,
                error: null,
                timestamp: new Date()
            });
        } else {
            // Actually close the account
            console.log(`  Closing ${account.address.slice(0, 8)}...`);
            const result = await closeAccount(account, keypair, network, destination);
            results.push(result);

            if (result.success) {
                console.log(`    ✅ Reclaimed ${result.rentReclaimed.toFixed(6)} SOL (${result.signature?.slice(0, 8)}...)`);
            } else {
                console.log(`    ❌ Failed: ${result.error}`);
            }

            // Rate limiting between transactions
            await new Promise(r => setTimeout(r, 500));
        }
    }

    // Summary
    const successful = results.filter(r => r.success);
    const totalReclaimed = successful.reduce((sum, r) => sum + r.rentReclaimed, 0);

    console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Reclaim Summary:`);
    console.log(`  Processed: ${results.length}`);
    console.log(`  Successful: ${successful.length}`);
    console.log(`  Total Reclaimed: ${totalReclaimed.toFixed(6)} SOL`);

    return results;
}
