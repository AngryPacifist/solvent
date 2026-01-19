/**
 * Solvent CLI - Reclaim Command
 * 
 * Reclaims rent from closeable accounts.
 */

import * as fs from 'fs';
import * as readline from 'readline';
import { Keypair } from '@solana/web3.js';
import {
    scanAndParseAccounts,
    classifyAccounts,
    getReclaimableAccounts,
    reclaimRent,
    lamportsToSol,
    type Network
} from '@solvent/core';

interface ReclaimOptions {
    network: string;
    keypair?: string;
    dryRun: boolean;
    yes: boolean;
}

function loadKeypair(path: string): Keypair {
    const secretKey = JSON.parse(fs.readFileSync(path, 'utf-8'));
    return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

async function confirm(message: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${message} (y/n): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

export async function reclaimCommand(address: string, options: ReclaimOptions) {
    const network = options.network as Network;

    console.log('\n🧪 SOLVENT - Rent Reclaimer\n');
    console.log(`Fee Payer: ${address}`);
    console.log(`Network: ${network}`);
    console.log(`Mode: ${options.dryRun ? 'DRY RUN (no transactions)' : 'LIVE'}\n`);

    // Check for keypair
    if (!options.dryRun && !options.keypair) {
        console.error('❌ Error: --keypair is required for live reclaim');
        console.error('   Use --dry-run to preview without a keypair');
        process.exit(1);
    }

    try {
        // Scan and classify
        console.log('Scanning for reclaimable accounts...');
        const creations = await scanAndParseAccounts(address, network, { limit: 100 });
        const accounts = await classifyAccounts(creations, address, network);

        // Get reclaimable accounts
        const reclaimable = getReclaimableAccounts(accounts);

        if (reclaimable.length === 0) {
            console.log('\n⚠️  No accounts available for reclaim.');
            console.log('   Accounts must be:');
            console.log('   - RECLAIMABLE (close_authority = fee payer)');
            console.log('   - CLOSEABLE (balance = 0)');
            return;
        }

        // Calculate total
        const totalLamports = reclaimable.reduce((sum, a) => sum + a.rentLamports, 0);
        const totalSol = lamportsToSol(totalLamports);

        console.log(`\n📊 Found ${reclaimable.length} accounts to reclaim`);
        console.log(`💰 Total rent to reclaim: ${totalSol.toFixed(6)} SOL\n`);

        // Preview accounts
        console.log('Accounts to close:');
        for (const account of reclaimable.slice(0, 10)) {
            console.log(`  - ${account.address.slice(0, 20)}... (${lamportsToSol(account.rentLamports).toFixed(6)} SOL)`);
        }
        if (reclaimable.length > 10) {
            console.log(`  ... and ${reclaimable.length - 10} more`);
        }

        // Confirmation
        if (!options.dryRun && !options.yes) {
            console.log('');
            const confirmed = await confirm('Proceed with reclaim?');
            if (!confirmed) {
                console.log('Cancelled.');
                return;
            }
        }

        // Load keypair and execute
        let keypair: Keypair | undefined;
        if (!options.dryRun && options.keypair) {
            keypair = loadKeypair(options.keypair);
            console.log(`\nUsing keypair: ${keypair.publicKey.toBase58()}`);
        }

        // Execute reclaim
        const results = await reclaimRent(
            reclaimable,
            keypair!,
            network,
            { dryRun: options.dryRun }
        );

        // Final summary
        const successful = results.filter(r => r.success);
        const totalReclaimed = successful.reduce((sum, r) => sum + r.rentReclaimed, 0);

        console.log('\n' + '═'.repeat(60));
        console.log(`${options.dryRun ? '[DRY RUN] ' : ''}RECLAIM COMPLETE`);
        console.log('═'.repeat(60));
        console.log(`  Accounts processed: ${results.length}`);
        console.log(`  Successful: ${successful.length}`);
        console.log(`  Failed: ${results.length - successful.length}`);
        console.log(`  Total reclaimed: ${totalReclaimed.toFixed(6)} SOL`);
        console.log('═'.repeat(60));

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}
