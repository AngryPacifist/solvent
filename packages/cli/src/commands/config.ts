/**
 * Solvent CLI - Config Command
 * 
 * Manage persistent CLI configuration
 */

import chalk from 'chalk';
import {
    loadConfig,
    setConfigValue,
    clearConfigValue,
    clearAllConfig,
    getConfigPath
} from '../config.js';

interface ConfigSetRpcOptions {
    // No additional options
}

interface ConfigSetNetworkOptions {
    // No additional options
}

/**
 * Show current config
 */
export function configShowCommand(): void {
    const config = loadConfig();
    const configPath = getConfigPath();

    console.log(chalk.cyan('\n🔧 Solvent Configuration\n'));
    console.log(chalk.dim(`Config file: ${configPath}\n`));

    if (!config.rpc && !config.network) {
        console.log(chalk.yellow('  No configuration set.\n'));
        console.log('  Use these commands to configure:');
        console.log(chalk.dim('    solvent config set-rpc <url>'));
        console.log(chalk.dim('    solvent config set-network <devnet|mainnet-beta>'));
        return;
    }

    console.log('  Current settings:');
    console.log(`    ${chalk.bold('RPC URL:')} ${config.rpc || chalk.dim('(not set)')}`);
    console.log(`    ${chalk.bold('Network:')} ${config.network || chalk.dim('(not set)')}`);
    console.log('');
}

/**
 * Set RPC URL
 */
export function configSetRpcCommand(url: string, _options: ConfigSetRpcOptions): void {
    // Validate URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.error(chalk.red('❌ Invalid URL. Must start with http:// or https://'));
        process.exit(1);
    }

    setConfigValue('rpc', url);
    console.log(chalk.green(`✅ RPC URL set to: ${url}`));
    console.log(chalk.dim('   All commands will now use this RPC by default.'));
}

/**
 * Set default network
 */
export function configSetNetworkCommand(network: string, _options: ConfigSetNetworkOptions): void {
    if (network !== 'devnet' && network !== 'mainnet-beta') {
        console.error(chalk.red('❌ Invalid network. Must be "devnet" or "mainnet-beta"'));
        process.exit(1);
    }

    setConfigValue('network', network as 'devnet' | 'mainnet-beta');
    console.log(chalk.green(`✅ Default network set to: ${network}`));
}

/**
 * Clear a specific config value
 */
export function configClearCommand(key: string): void {
    if (key === 'rpc') {
        clearConfigValue('rpc');
        console.log(chalk.green('✅ RPC URL cleared.'));
    } else if (key === 'network') {
        clearConfigValue('network');
        console.log(chalk.green('✅ Default network cleared.'));
    } else if (key === 'all') {
        clearAllConfig();
        console.log(chalk.green('✅ All configuration cleared.'));
    } else {
        console.error(chalk.red(`❌ Unknown config key: ${key}`));
        console.log(chalk.dim('   Valid keys: rpc, network, all'));
        process.exit(1);
    }
}
