/**
 * Export Command
 * 
 * Export account data to JSON or CSV format
 */

import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import { scanAndParseAccounts, classifyAccounts, calculateRentStats, getNetworkConfig, lamportsToSol } from '@solvent/core';
import type { SponsoredAccount } from '@solvent/core';

interface ExportOptions {
    network: string;
    format: string;
    output: string;
    limit: string;
}

export async function exportCommand(address: string, options: ExportOptions): Promise<void> {
    const { network, format, output, limit } = options;
    const config = getNetworkConfig(network as 'devnet' | 'mainnet-beta');

    const spinner = ora('Scanning fee payer history...').start();

    try {
        // Scan and classify
        const creations = await scanAndParseAccounts(address, network as 'devnet' | 'mainnet-beta');
        spinner.text = 'Classifying accounts...';
        const accounts = await classifyAccounts(creations, address, network as 'devnet' | 'mainnet-beta');
        spinner.succeed('Scan complete!');

        // Calculate stats
        const stats = calculateRentStats(accounts);

        // Prepare output filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `${output}-${timestamp}.${format}`;

        if (format === 'json') {
            // JSON export
            const data = {
                feePayer: address,
                network,
                exportedAt: new Date().toISOString(),
                stats: {
                    totalAccounts: stats.totalAccounts,
                    totalRentLocked: stats.totalLocked,
                    reclaimable: stats.reclaimable,
                    closeableAccounts: stats.closeableAccounts,
                    reclaimableAccounts: stats.reclaimableAccounts
                },
                accounts: accounts.map(a => ({
                    address: a.address,
                    type: a.type,
                    owner: a.owner,
                    closeAuthority: a.closeAuthority,
                    mint: a.mint,
                    rentSOL: lamportsToSol(a.rentLamports),
                    tokenBalance: a.tokenBalance,
                    classification: a.classification,
                    status: a.status,
                    createdAt: a.createdAt.toISOString()
                }))
            };
            fs.writeFileSync(filename, JSON.stringify(data, null, 2));
        } else {
            // CSV export
            const headers = 'Address,Type,Owner,CloseAuthority,Mint,RentSOL,TokenBalance,Classification,Status,CreatedAt';
            const rows = accounts.map((a: SponsoredAccount) =>
                `${a.address},${a.type},${a.owner},${a.closeAuthority || ''},${a.mint || ''},${lamportsToSol(a.rentLamports)},${a.tokenBalance},${a.classification},${a.status},${a.createdAt.toISOString()}`
            );
            fs.writeFileSync(filename, [headers, ...rows].join('\n'));
        }

        console.log();
        console.log(chalk.green('✓ Report exported successfully!'));
        console.log(chalk.dim(`  File: ${filename}`));
        console.log(chalk.dim(`  Accounts: ${accounts.length}`));
        console.log(chalk.dim(`  Format: ${format.toUpperCase()}`));
    } catch (error: any) {
        spinner.fail('Export failed');
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
    }
}
