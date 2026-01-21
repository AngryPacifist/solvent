/**
 * Watch Command
 * 
 * Poll for new closeable accounts at regular intervals
 */

import chalk from 'chalk';
import ora from 'ora';
import { scanAndParseAccounts, classifyAccounts, calculateRentStats } from '@solvent/core';
import { loadConfig } from '../config.js';

interface WatchOptions {
    network: string;
    rpc?: string;
    interval: string;
    limit: string;
}

export async function watchCommand(address: string, options: WatchOptions): Promise<void> {
    const config = loadConfig();
    const network = (config.network || options.network) as 'devnet' | 'mainnet-beta';
    const rpcUrl = options.rpc || config.rpc;
    const pollInterval = parseInt(options.interval) * 1000;

    let previousCloseableCount = 0;
    let previousReclaimable = 0;
    let scanCount = 0;
    let isScanning = false;

    console.log(chalk.cyan('\n👁️  Watching for closeable accounts...'));
    console.log(chalk.dim(`   Address: ${address}`));
    console.log(chalk.dim(`   Network: ${network}`));
    if (rpcUrl) console.log(chalk.dim(`   RPC: ${rpcUrl}`));
    console.log(chalk.dim(`   Interval: ${options.interval}s`));
    console.log(chalk.dim('   Press Ctrl+C to stop\n'));

    const scan = async () => {
        // Prevent overlapping scans
        if (isScanning) {
            console.log(chalk.yellow('   ⏳ Previous scan still running, skipping...'));
            return;
        }

        isScanning = true;
        scanCount++;
        const timestamp = new Date().toLocaleTimeString();
        const spinner = ora(`[${timestamp}] Scan #${scanCount}...`).start();

        try {
            const scanOptions = { ...(rpcUrl && { rpcUrl }) };
            const creations = await scanAndParseAccounts(address, network, scanOptions);
            const accounts = await classifyAccounts(creations, address, network, rpcUrl);
            const stats = calculateRentStats(accounts);

            spinner.stop();

            // Check for changes (stats.reclaimable is already in SOL, not lamports)
            const closeableChange = stats.closeableAccounts - previousCloseableCount;
            const reclaimChange = stats.reclaimable - previousReclaimable;

            // Status line
            let statusLine = chalk.dim(`[${timestamp}] `);
            statusLine += `${stats.closeableAccounts} closeable, `;
            statusLine += `${stats.reclaimable.toFixed(4)} SOL reclaimable`;

            // Alert on new closeable accounts
            if (closeableChange > 0 && scanCount > 1) {
                console.log(chalk.green.bold(`\n🔔 NEW! +${closeableChange} closeable account(s)!`));
                console.log(chalk.green(`   +${reclaimChange.toFixed(4)} SOL now reclaimable`));
            } else if (closeableChange < 0 && scanCount > 1) {
                console.log(chalk.yellow(`\n📤 ${Math.abs(closeableChange)} account(s) closed`));
            }

            console.log(statusLine);

            previousCloseableCount = stats.closeableAccounts;
            previousReclaimable = stats.reclaimable;
        } catch (error: any) {
            spinner.fail(`Scan failed: ${error.message}`);
        } finally {
            isScanning = false;
        }
    };

    // Initial scan
    await scan();

    // Set up polling - use setTimeout recursively to wait for scan completion
    const scheduleScan = () => {
        setTimeout(async () => {
            await scan();
            scheduleScan();
        }, pollInterval);
    };

    scheduleScan();
}
