#!/usr/bin/env node
/**
 * Solvent CLI
 * 
 * Command-line interface for Kora rent monitoring and reclaim.
 */

import { Command } from 'commander';
import { scanCommand } from './commands/scan.js';
import { listCommand } from './commands/list.js';
import { reclaimCommand } from './commands/reclaim.js';

const program = new Command();

program
    .name('solvent')
    .description('🧪 Solvent - Rent monitoring and reclaim for Kora operators')
    .version('1.0.0');

// Scan command
program
    .command('scan <address>')
    .description('Scan a fee payer address for sponsored accounts')
    .option('-n, --network <network>', 'Network to use (devnet or mainnet-beta)', 'devnet')
    .option('-l, --limit <number>', 'Maximum transactions to scan', '100')
    .action(scanCommand);

// List command
program
    .command('list <address>')
    .description('List all sponsored accounts with details')
    .option('-n, --network <network>', 'Network to use (devnet or mainnet-beta)', 'devnet')
    .option('-f, --filter <type>', 'Filter by type (all, reclaimable, closeable)', 'all')
    .option('-l, --limit <number>', 'Maximum transactions to scan', '100')
    .action(listCommand);

// Reclaim command
program
    .command('reclaim <address>')
    .description('Reclaim rent from closeable accounts')
    .option('-n, --network <network>', 'Network to use (devnet or mainnet-beta)', 'devnet')
    .option('-k, --keypair <path>', 'Path to keypair file')
    .option('--dry-run', 'Preview actions without executing', false)
    .option('-y, --yes', 'Skip confirmation prompt', false)
    .action(reclaimCommand);

program.parse();
