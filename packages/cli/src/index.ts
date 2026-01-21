#!/usr/bin/env node
/**
 * Solvent CLI
 * 
 * Command-line interface for Kora rent monitoring and reclaim.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { scanCommand } from './commands/scan.js';
import { listCommand } from './commands/list.js';
import { reclaimCommand } from './commands/reclaim.js';
import { exportCommand } from './commands/export.js';
import { watchCommand } from './commands/watch.js';
import {
    configShowCommand,
    configSetRpcCommand,
    configSetNetworkCommand,
    configClearCommand
} from './commands/config.js';

// ASCII Art Banner
const banner = `
${chalk.cyan('╔═══════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.greenBright(' ____        _                 _   ')}                     ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.bold.greenBright('/ ___|  ___ | |_   _____ _ __ | |_ ')}                     ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.bold.greenBright('\\___ \\ / _ \\| \\ \\ / / _ \\ \'_ \\| __|')}                     ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.bold.greenBright(' ___) | (_) | |\\ V /  __/ | | | |_ ')}                     ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.bold.greenBright('|____/ \\___/|_| \\_/ \\___|_| |_|\\__|')}                     ${chalk.cyan('║')}
${chalk.cyan('║')}                                                           ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.dim('🧪 Rent monitoring and reclaim for Kora operators')}        ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════════════════╝')}
`;

// Show banner on help or no command
const showBanner = () => console.log(banner);

// Show banner immediately
showBanner();

const program = new Command();

program
    .name('solvent')
    .description('Rent monitoring and reclaim for Kora operators')
    .version('1.0.0');

// Scan command
program
    .command('scan <address>')
    .description('Scan a fee payer address for sponsored accounts')
    .option('-n, --network <network>', 'Network to use (devnet or mainnet-beta)', 'devnet')
    .option('-r, --rpc <url>', 'Custom RPC endpoint URL')
    .option('-l, --limit <number>', 'Maximum transactions to scan', '100')
    .action(scanCommand);

// List command
program
    .command('list <address>')
    .description('List all sponsored accounts with details')
    .option('-n, --network <network>', 'Network to use (devnet or mainnet-beta)', 'devnet')
    .option('-r, --rpc <url>', 'Custom RPC endpoint URL')
    .option('-f, --filter <type>', 'Filter by type (all, reclaimable, closeable)', 'all')
    .option('-l, --limit <number>', 'Maximum transactions to scan', '100')
    .action(listCommand);

// Reclaim command
program
    .command('reclaim <address>')
    .description('Reclaim rent from closeable accounts')
    .option('-n, --network <network>', 'Network to use (devnet or mainnet-beta)', 'devnet')
    .option('-r, --rpc <url>', 'Custom RPC endpoint URL')
    .option('-k, --keypair <path>', 'Path to keypair file')
    .option('--dry-run', 'Preview actions without executing', false)
    .option('-y, --yes', 'Skip confirmation prompt', false)
    .action(reclaimCommand);

// Export command
program
    .command('export <address>')
    .description('Export account data to JSON or CSV file')
    .option('-n, --network <network>', 'Network to use (devnet or mainnet-beta)', 'devnet')
    .option('-r, --rpc <url>', 'Custom RPC endpoint URL')
    .option('-f, --format <format>', 'Output format (json or csv)', 'json')
    .option('-o, --output <path>', 'Output file path', 'solvent-report')
    .option('-l, --limit <number>', 'Maximum transactions to scan', '100')
    .action(exportCommand);

// Watch command
program
    .command('watch <address>')
    .description('Watch for new closeable accounts')
    .option('-n, --network <network>', 'Network to use (devnet or mainnet-beta)', 'devnet')
    .option('-r, --rpc <url>', 'Custom RPC endpoint URL')
    .option('-i, --interval <seconds>', 'Polling interval in seconds', '60')
    .option('-l, --limit <number>', 'Maximum transactions to scan', '100')
    .action(watchCommand);

// Config command group
const configCmd = program
    .command('config')
    .description('Manage CLI configuration');

configCmd
    .command('show')
    .description('Show current configuration')
    .action(configShowCommand);

configCmd
    .command('set-rpc <url>')
    .description('Set custom RPC URL (used by all commands)')
    .action(configSetRpcCommand);

configCmd
    .command('set-network <network>')
    .description('Set default network (devnet or mainnet-beta)')
    .action(configSetNetworkCommand);

configCmd
    .command('clear <key>')
    .description('Clear a config value (rpc, network, or all)')
    .action(configClearCommand);

program.parse();
