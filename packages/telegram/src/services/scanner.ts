// Import from npm package
import { scanAndParseAccounts, classifyAccounts, calculateRentStats, lamportsToSol } from '@angrypacifist/solvent-core'
import type { Network, SponsoredAccount, RentStats } from '@angrypacifist/solvent-core'

export interface ScanResult {
    address: string
    network: Network
    accounts: SponsoredAccount[]
    stats: RentStats
    closeableAccounts: SponsoredAccount[]
    reclaimableAccounts: SponsoredAccount[]
}

export async function performScan(address: string, network: Network, customRpc?: string): Promise<ScanResult> {
    // Use core library to scan - pass custom RPC if provided
    const scanOptions = { limit: 200, ...(customRpc && { rpcUrl: customRpc }) }
    const creations = await scanAndParseAccounts(address, network, scanOptions)
    const accounts = await classifyAccounts(creations, address, network, customRpc)
    const stats = calculateRentStats(accounts)

    const closeableAccounts = accounts.filter(a => a.status === 'CLOSEABLE')
    const reclaimableAccounts = accounts.filter(a => a.classification === 'RECLAIMABLE')

    return {
        address,
        network,
        accounts,
        stats,
        closeableAccounts,
        reclaimableAccounts,
    }
}

export function formatScanMessage(result: ScanResult): string {
    const { stats, address, network, closeableAccounts, reclaimableAccounts } = result

    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`
    const networkEmoji = network === 'mainnet-beta' ? '🟢' : '🔵'
    const networkDisplay = network === 'mainnet-beta' ? 'mainnet' : 'devnet'

    let message = `🧪 *SOLVENT SCAN RESULTS*\n\n`
    message += `${networkEmoji} *Address:*\n\`${address}\`\n`
    message += `📊 *Network:* ${networkDisplay}\n\n`

    message += `📈 *Statistics:*\n`
    message += `├ Total Accounts: *${stats.totalAccounts}*\n`
    message += `├ Total Rent Locked: *${stats.totalLocked.toFixed(4)} SOL*\n`
    message += `├ Reclaimable Rent: *${stats.reclaimable.toFixed(4)} SOL*\n`
    message += `└ Closeable Accounts: *${stats.closeableAccounts}*\n\n`

    if (closeableAccounts.length > 0) {
        message += `✅ *Closeable Accounts:*\n`
        const toShow = closeableAccounts.slice(0, 10)
        toShow.forEach(acc => {
            const reclaim = acc.classification === 'RECLAIMABLE' ? '♻️' : '👁️'
            message += `${reclaim} \`${acc.address}\`\n   └ ${lamportsToSol(acc.rentLamports).toFixed(4)} SOL\n`
        })
        if (closeableAccounts.length > 10) {
            message += `_...and ${closeableAccounts.length - 10} more_\n`
        }
        message += `\n`
    }

    if (reclaimableAccounts.length > 0) {
        message += `♻️ *Reclaimable:* ${reclaimableAccounts.length} accounts\n`
        message += `💰 *Potential Savings:* ${stats.reclaimable.toFixed(4)} SOL\n\n`
        message += `_Run_ \`solvent reclaim ${shortAddr}\` _to claim!_`
    } else {
        message += `ℹ️ _No reclaimable accounts at this time._\n`
        message += `_Accounts without close authority set to you are monitor-only._`
    }

    return message
}

export function formatStatusMessage(trackedScans: ScanResult[]): string {
    if (trackedScans.length === 0) {
        return `📭 *No tracked addresses*\n\nUse /track <address> to start monitoring!`
    }

    let message = `📊 *SOLVENT STATUS*\n\n`

    let totalRent = 0
    let totalCloseable = 0
    let totalReclaimable = 0

    for (const scan of trackedScans) {
        const shortAddr = `${scan.address.slice(0, 6)}...${scan.address.slice(-4)}`
        const networkEmoji = scan.network === 'mainnet-beta' ? '🟢' : '🔵'

        message += `${networkEmoji} \`${shortAddr}\`\n`
        message += `  └ ${scan.stats.closeableAccounts} closeable, ${scan.stats.totalLocked.toFixed(4)} SOL\n`

        totalRent += scan.stats.totalLocked
        totalCloseable += scan.stats.closeableAccounts
        totalReclaimable += scan.stats.reclaimable
    }

    message += `\n📈 *Totals:*\n`
    message += `├ Tracked Addresses: *${trackedScans.length}*\n`
    message += `├ Total Closeable: *${totalCloseable}*\n`
    message += `├ Total Rent Locked: *${totalRent.toFixed(4)} SOL*\n`
    message += `└ Reclaimable: *${totalReclaimable.toFixed(4)} SOL*\n`

    return message
}

export function formatAlertMessage(
    address: string,
    oldStats: { closeableCount: number; totalRentSOL: number } | null,
    newStats: { closeableCount: number; totalRentSOL: number }
): string | null {
    if (!oldStats) return null

    const newCloseable = newStats.closeableCount - oldStats.closeableCount
    if (newCloseable <= 0) return null

    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`

    let message = `🔔 *SOLVENT ALERT*\n\n`
    message += `*${newCloseable} new closeable account(s)* detected!\n\n`
    message += `📍 Address: \`${shortAddr}\`\n`
    message += `📊 Total Closeable: ${newStats.closeableCount}\n`
    message += `💰 Total Rent: ${newStats.totalRentSOL.toFixed(4)} SOL\n\n`
    message += `Run /scan ${address.slice(0, 12)}... for details`

    return message
}
