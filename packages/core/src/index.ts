/**
 * Solvent Core Library
 * 
 * Rent monitoring and reclaim tool for Kora operators on Solana.
 * 
 * @example
 * ```typescript
 * import { scanAndParseAccounts, classifyAccounts, calculateRentStats } from '@solvent/core';
 * 
 * const creations = await scanAndParseAccounts(feePayerAddress, 'devnet');
 * const accounts = await classifyAccounts(creations, feePayerAddress, 'devnet');
 * const stats = calculateRentStats(accounts);
 * ```
 */

// Types
export * from './types.js';

// Configuration
export {
    getConnection,
    getNetworkConfig,
    lamportsToSol,
    solToLamports,
    formatSol,
    ESTIMATED_RENT,
    ACCOUNT_SIZES
} from './config.js';

// Scanner
export {
    scanFeePayerHistory,
    parseTransaction,
    scanAndParseAccounts,
    type TransactionInfo,
    type ParsedAccountCreation
} from './scanner.js';

// Classifier
export {
    classifyAccount,
    classifyAccounts
} from './classifier.js';

// Analyzer
export {
    calculateRentStats,
    getReclaimableAccounts,
    getAlertableAccounts,
    formatRentStats,
    formatAccountRow
} from './analyzer.js';

// Reclaimer
export {
    closeAccount,
    reclaimRent
} from './reclaimer.js';
