/**
 * Solvent CLI - Scan Command
 * 
 * Scans a fee payer for sponsored accounts and displays summary.
 */

import {
    scanAndParseAccounts,
    classifyAccounts,
    calculateRentStats,
    formatRentStats,
    type Network
} from '@solvent/core';
import { loadConfig } from '../config.js';

interface ScanOptions {
    network: string;
    rpc?: string;
    limit: string;
}

export async function scanCommand(address: string, options: ScanOptions) {
    // Load persistent config
    const config = loadConfig();

    // CLI options override config, config overrides defaults
    const network = (options.rpc ? options.network : config.network || options.network) as Network;
    const limit = parseInt(options.limit, 10);
    const rpcUrl = options.rpc || config.rpc;

    console.log('\n🧪 SOLVENT - Rent Scanner\n');
    console.log(`Fee Payer: ${address}`);
    console.log(`Network: ${network}`);
    if (rpcUrl) console.log(`RPC: ${rpcUrl}${config.rpc && !options.rpc ? ' (from config)' : ''}`);
    console.log(`Limit: ${limit} transactions\n`);

    try {
        // Scan transaction history
        console.log('━'.repeat(60));
        const scanOptions = { limit, ...(rpcUrl && { rpcUrl }) };
        const creations = await scanAndParseAccounts(address, network, scanOptions);

        if (creations.length === 0) {
            console.log('\n⚠️  No account creations found for this fee payer.');
            console.log('   This could mean:');
            console.log('   - No transactions yet');
            console.log('   - Different fee payer address');
            console.log('   - Increase --limit to scan more history');
            return;
        }

        // Classify accounts
        console.log('━'.repeat(60));
        const accounts = await classifyAccounts(creations, address, network, rpcUrl);

        // Calculate and display stats
        const stats = calculateRentStats(accounts);
        console.log(formatRentStats(stats));

        // Quick tips
        if (stats.reclaimableAccounts > 0) {
            console.log(`💡 Tip: Run 'solvent reclaim ${address}' to reclaim ${stats.reclaimable.toFixed(6)} SOL`);
        }

        if (stats.closeableAccounts > stats.reclaimableAccounts) {
            const alertable = stats.closeableAccounts - stats.reclaimableAccounts;
            console.log(`ℹ️  Note: ${alertable} closeable accounts require owner action (monitor-only)`);
        }

        // ROI Calculator - show potential savings
        const monitorOnlyCloseable = accounts.filter(
            a => a.classification === 'MONITOR_ONLY' && a.status === 'CLOSEABLE'
        );
        if (monitorOnlyCloseable.length > 0) {
            const potentialSavings = monitorOnlyCloseable.reduce(
                (sum, a) => sum + a.rentLamports, 0
            ) / 1_000_000_000;
            console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
            console.log(`║  💎 ROI CALCULATOR                                             ║`);
            console.log(`╠════════════════════════════════════════════════════════════════╣`);
            console.log(`║  If close_authority was set to fee payer during creation:      ║`);
            console.log(`║  → You could reclaim: ${potentialSavings.toFixed(6).padStart(10)} SOL (${monitorOnlyCloseable.length} accounts)       ║`);
            console.log(`║                                                                ║`);
            console.log(`║  💡 Set close_authority = fee payer when sponsoring ATAs       ║`);
            console.log(`╚════════════════════════════════════════════════════════════════╝`);
        }

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}
