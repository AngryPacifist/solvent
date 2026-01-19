/**
 * Solvent - Network Configuration
 * 
 * Handles network switching between devnet and mainnet.
 */

import { Connection, clusterApiUrl } from '@solana/web3.js';
import type { Network, NetworkConfig } from './types.js';

// Default RPC URLs
const RPC_URLS: Record<Network, string> = {
    'devnet': 'https://api.devnet.solana.com',
    'mainnet-beta': 'https://api.mainnet-beta.solana.com'
};

// Rent per byte (approximate, for estimation)
export const RENT_PER_BYTE = 0.00000696; // SOL per byte per epoch

// Common account sizes
export const ACCOUNT_SIZES = {
    TOKEN_ACCOUNT: 165, // bytes
    MINT_ACCOUNT: 82,
    SYSTEM_ACCOUNT: 0 // varies
};

// Estimated rent for common accounts
export const ESTIMATED_RENT = {
    TOKEN_ACCOUNT: 0.00203928, // ~0.002 SOL
    MINT_ACCOUNT: 0.00144768
};

/**
 * Get a Solana connection for the specified network
 */
export function getConnection(network: Network, customRpcUrl?: string): Connection {
    const rpcUrl = customRpcUrl || RPC_URLS[network];
    return new Connection(rpcUrl, 'confirmed');
}

/**
 * Get network configuration
 */
export function getNetworkConfig(network: Network, customRpcUrl?: string): NetworkConfig {
    return {
        network,
        rpcUrl: customRpcUrl || RPC_URLS[network]
    };
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
    return lamports / 1_000_000_000;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
    return Math.floor(sol * 1_000_000_000);
}

/**
 * Format SOL amount for display
 */
export function formatSol(lamports: number, decimals: number = 6): string {
    const sol = lamportsToSol(lamports);
    return `${sol.toFixed(decimals)} SOL`;
}
