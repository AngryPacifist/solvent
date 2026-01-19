/**
 * Solvent CLI - List Command
 * 
 * Lists all sponsored accounts with details.
 */

import {
    scanAndParseAccounts,
    classifyAccounts,
    getReclaimableAccounts,
    lamportsToSol,
    type Network,
    type SponsoredAccount
} from '@solvent/core';

interface ListOptions {
    network: string;
    filter: string;
    limit: string;
}

function formatAccountTable(accounts: SponsoredAccount[]): void {
    // Header
    console.log('\n┌──────────────────┬────────┬──────────────┬──────────┬────────────┐');
    console.log('│ Address          │ Type   │ Rent (SOL)   │ Status   │ Reclaim?   │');
    console.log('├──────────────────┼────────┼──────────────┼──────────┼────────────┤');

    for (const account of accounts) {
        const addr = account.address.slice(0, 16) + '...';
        const type = account.type.padEnd(6);
        const rent = lamportsToSol(account.rentLamports).toFixed(6).padStart(12);
        const status = account.status === 'CLOSEABLE' ? '✅ Close' : '🔒 Active';
        const reclaim = account.classification === 'RECLAIMABLE' ? '♻️ Yes' : '👁️ No';

        console.log(`│ ${addr} │ ${type} │ ${rent} │ ${status.padEnd(8)} │ ${reclaim.padEnd(10)} │`);
    }

    console.log('└──────────────────┴────────┴──────────────┴──────────┴────────────┘');
}

export async function listCommand(address: string, options: ListOptions) {
    const network = options.network as Network;
    const limit = parseInt(options.limit, 10);

    console.log('\n🧪 SOLVENT - Account List\n');
    console.log(`Fee Payer: ${address}`);
    console.log(`Network: ${network}`);
    console.log(`Filter: ${options.filter}\n`);

    try {
        // Scan and classify
        console.log('Scanning...');
        const creations = await scanAndParseAccounts(address, network, { limit });
        const accounts = await classifyAccounts(creations, address, network);

        // Apply filter
        let filtered = accounts;
        if (options.filter === 'reclaimable') {
            filtered = accounts.filter(a => a.classification === 'RECLAIMABLE');
        } else if (options.filter === 'closeable') {
            filtered = accounts.filter(a => a.status === 'CLOSEABLE');
        }

        if (filtered.length === 0) {
            console.log(`\n⚠️  No accounts found matching filter: ${options.filter}`);
            return;
        }

        // Display table
        formatAccountTable(filtered);

        console.log(`\nShowing ${filtered.length} of ${accounts.length} accounts`);

        // Summary
        const reclaimable = getReclaimableAccounts(accounts);
        const totalReclaimable = reclaimable.reduce((sum, a) => sum + a.rentLamports, 0);

        if (reclaimable.length > 0) {
            console.log(`\n💰 ${reclaimable.length} accounts ready to reclaim: ${lamportsToSol(totalReclaimable).toFixed(6)} SOL`);
        }

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}
