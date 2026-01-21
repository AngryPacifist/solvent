/**
 * Solvent CLI - Config Module
 * 
 * Handles persistent configuration stored in ~/.solvent/config.json
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// Config file location
const CONFIG_DIR = path.join(os.homedir(), '.solvent');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface SolventConfig {
    /** Custom RPC URL */
    rpc?: string;
    /** Default network */
    network?: 'devnet' | 'mainnet-beta';
}

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

/**
 * Load config from file
 */
export function loadConfig(): SolventConfig {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (e) {
        // Ignore errors, return empty config
    }
    return {};
}

/**
 * Save config to file
 */
export function saveConfig(config: SolventConfig): void {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Get a config value, with CLI option taking precedence
 */
export function getConfigValue<K extends keyof SolventConfig>(
    key: K,
    cliValue?: SolventConfig[K]
): SolventConfig[K] | undefined {
    // CLI value takes precedence
    if (cliValue !== undefined) {
        return cliValue;
    }
    // Otherwise use stored config
    const config = loadConfig();
    return config[key];
}

/**
 * Set a config value
 */
export function setConfigValue<K extends keyof SolventConfig>(
    key: K,
    value: SolventConfig[K]
): void {
    const config = loadConfig();
    config[key] = value;
    saveConfig(config);
}

/**
 * Clear a config value
 */
export function clearConfigValue<K extends keyof SolventConfig>(key: K): void {
    const config = loadConfig();
    delete config[key];
    saveConfig(config);
}

/**
 * Clear all config
 */
export function clearAllConfig(): void {
    saveConfig({});
}

/**
 * Get config file path (for display)
 */
export function getConfigPath(): string {
    return CONFIG_FILE;
}
