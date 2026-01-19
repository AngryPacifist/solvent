/**
 * Solvent - Rent Analyzer
 * 
 * Calculates rent statistics and identifies closeable accounts.
 */

import type { SponsoredAccount, RentStats } from './types.js';
import { lamportsToSol } from './config.js';

/**
 * Calculate rent statistics from a list of accounts
 */
export function calculateRentStats(accounts: SponsoredAccount[]): RentStats {
    const activeAccounts = accounts.filter(a => a.status !== 'CLOSED');

    // Total rent locked
    const totalLocked = activeAccounts.reduce((sum, a) => sum + a.rentLamports, 0);

    // Reclaimable (close_authority = fee payer + balance = 0)
    const reclaimableAccounts = activeAccounts.filter(
        a => a.classification === 'RECLAIMABLE' && a.status === 'CLOSEABLE'
    );
    const reclaimable = reclaimableAccounts.reduce((sum, a) => sum + a.rentLamports, 0);

    // Monitor only (can't auto-reclaim)
    const monitorOnlyAccounts = activeAccounts.filter(a => a.classification === 'MONITOR_ONLY');
    const monitorOnly = monitorOnlyAccounts.reduce((sum, a) => sum + a.rentLamports, 0);

    // Closeable (balance = 0, regardless of who can close)
    const closeableAccounts = activeAccounts.filter(a => a.status === 'CLOSEABLE');

    return {
        totalLocked: lamportsToSol(totalLocked),
        reclaimable: lamportsToSol(reclaimable),
        monitorOnly: lamportsToSol(monitorOnly),
        totalAccounts: activeAccounts.length,
        closeableAccounts: closeableAccounts.length,
        reclaimableAccounts: reclaimableAccounts.length
    };
}

/**
 * Get accounts that can be automatically reclaimed
 */
export function getReclaimableAccounts(accounts: SponsoredAccount[]): SponsoredAccount[] {
    return accounts.filter(
        a => a.classification === 'RECLAIMABLE' &&
            a.status === 'CLOSEABLE' &&
            a.tokenBalance === 0
    );
}

/**
 * Get accounts that need user notification (monitor only + closeable)
 */
export function getAlertableAccounts(accounts: SponsoredAccount[]): SponsoredAccount[] {
    return accounts.filter(
        a => a.classification === 'MONITOR_ONLY' &&
            a.status === 'CLOSEABLE' &&
            a.tokenBalance === 0
    );
}

/**
 * Format rent stats for display
 */
export function formatRentStats(stats: RentStats): string {
    return `
╔══════════════════════════════════════════════════════════════╗
║                    SOLVENT RENT REPORT                       ║
╠══════════════════════════════════════════════════════════════╣
║  📊 Total Accounts:           ${String(stats.totalAccounts).padStart(10)}                  ║
║  💰 Total Rent Locked:        ${stats.totalLocked.toFixed(6).padStart(10)} SOL             ║
╠══════════════════════════════════════════════════════════════╣
║  ✅ Reclaimable Accounts:     ${String(stats.reclaimableAccounts).padStart(10)}                  ║
║  💎 Reclaimable Rent:         ${stats.reclaimable.toFixed(6).padStart(10)} SOL             ║
╠══════════════════════════════════════════════════════════════╣
║  👁️  Monitor-Only Rent:        ${stats.monitorOnly.toFixed(6).padStart(10)} SOL             ║
║  ⏳ Closeable (balance=0):    ${String(stats.closeableAccounts).padStart(10)}                  ║
╚══════════════════════════════════════════════════════════════╝
`;
}

/**
 * Format account for table display
 */
export function formatAccountRow(account: SponsoredAccount): string {
    const addr = account.address.slice(0, 8) + '...';
    const rent = lamportsToSol(account.rentLamports).toFixed(4);
    const status = account.status === 'CLOSEABLE' ? '✅' : '🔒';
    const classification = account.classification === 'RECLAIMABLE' ? '♻️' : '👁️';

    return `${addr} | ${account.type.padEnd(6)} | ${rent} SOL | ${status} ${classification}`;
}
