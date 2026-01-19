/**
 * Solvent - Core Types
 * 
 * Type definitions for the rent monitoring and reclaim system.
 */

import { PublicKey } from '@solana/web3.js';

// Network configuration
export type Network = 'devnet' | 'mainnet-beta';

export interface NetworkConfig {
    network: Network;
    rpcUrl: string;
}

// Account classification
export type AccountClassification = 'RECLAIMABLE' | 'MONITOR_ONLY';
export type AccountType = 'ATA' | 'SYSTEM' | 'PDA' | 'UNKNOWN';
export type AccountStatus = 'ACTIVE' | 'CLOSEABLE' | 'CLOSED';

// Sponsored account data
export interface SponsoredAccount {
    /** Account address (base58) */
    address: string;

    /** Type of account */
    type: AccountType;

    /** Account owner (who can transfer tokens) */
    owner: string;

    /** Close authority (who can close the account) */
    closeAuthority: string | null;

    /** Token mint (for ATAs) */
    mint: string | null;

    /** Rent locked in lamports */
    rentLamports: number;

    /** Current token balance (for ATAs) */
    tokenBalance: number;

    /** Classification: can we auto-reclaim or just monitor? */
    classification: AccountClassification;

    /** Current status */
    status: AccountStatus;

    /** Transaction signature that created this account */
    creationSignature: string;

    /** Block time of creation */
    createdAt: Date;
}

// Rent statistics
export interface RentStats {
    /** Total rent locked (in SOL) */
    totalLocked: number;

    /** Rent that can be auto-reclaimed (in SOL) */
    reclaimable: number;

    /** Rent that requires manual action (in SOL) */
    monitorOnly: number;

    /** Total number of sponsored accounts */
    totalAccounts: number;

    /** Accounts ready to close (balance = 0) */
    closeableAccounts: number;

    /** Accounts with close_authority = fee payer */
    reclaimableAccounts: number;
}

// Reclaim operation result
export interface ReclaimResult {
    /** Account that was closed */
    account: string;

    /** Whether the operation succeeded */
    success: boolean;

    /** Amount of rent reclaimed (in SOL) */
    rentReclaimed: number;

    /** Transaction signature (if successful) */
    signature: string | null;

    /** Error message (if failed) */
    error: string | null;

    /** Timestamp of operation */
    timestamp: Date;
}

// Audit log entry
export interface AuditLogEntry {
    /** Unique ID */
    id: string;

    /** Type of action */
    action: 'SCANNED' | 'CLASSIFIED' | 'CLOSED' | 'ALERT_SENT' | 'ERROR';

    /** Account involved */
    account: string;

    /** Details about the action */
    details: string;

    /** Transaction signature (if applicable) */
    signature: string | null;

    /** Timestamp */
    timestamp: Date;
}

// Scan options
export interface ScanOptions {
    /** Maximum number of transactions to scan */
    limit?: number;

    /** Only return accounts matching this classification */
    filter?: AccountClassification;

    /** Include closed accounts in results */
    includeClosed?: boolean;
}

// Reclaim options
export interface ReclaimOptions {
    /** Dry run - don't actually close accounts */
    dryRun?: boolean;

    /** Maximum accounts to close in one batch */
    batchSize?: number;

    /** Destination for reclaimed rent (defaults to fee payer) */
    destination?: string;
}
