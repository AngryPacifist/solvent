import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Bot } from 'grammy'
import {
    getAllTrackedAddresses,
    getCachedScan,
    setCachedScan,
    getUserPrefs
} from '../src/services/redis.js'
import { performScan, formatAlertMessage } from '../src/services/scanner.js'

// Cron endpoint for scheduled scans
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.authorization
    const querySecret = req.query.secret as string | undefined
    const cronSecret = process.env.CRON_SECRET

    const isAuthorized = cronSecret && (
        authHeader === `Bearer ${cronSecret}` ||
        querySecret === cronSecret
    )

    if (!isAuthorized) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    // Only accept GET or POST (for cron-job.org)
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    console.log('🕐 Starting scheduled scan job...')

    try {
        const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!)

        // Get all tracked addresses and their users
        const addressToUsers = await getAllTrackedAddresses()

        if (addressToUsers.size === 0) {
            console.log('No addresses being tracked')
            return res.status(200).json({ message: 'No addresses to scan', scanned: 0 })
        }

        let scannedCount = 0
        let alertsSent = 0

        // Scan each unique address once
        for (const [address, chatIds] of addressToUsers) {
            try {
                // Get first user's network preference (could be improved)
                const prefs = await getUserPrefs(chatIds[0])

                // Perform scan
                const result = await performScan(address, prefs.network)

                // Get cached results for comparison
                const cached = await getCachedScan(address)

                const newStats = {
                    totalAccounts: result.stats.totalAccounts,
                    closeableCount: result.stats.closeableAccounts,
                    reclaimableCount: result.reclaimableAccounts.length,
                    totalRentSOL: result.stats.totalLocked,
                    lastScan: Date.now(),
                }

                // Check if we should send alerts
                if (cached) {
                    const alertMessage = formatAlertMessage(
                        address,
                        { closeableCount: cached.closeableCount, totalRentSOL: cached.totalRentSOL },
                        { closeableCount: newStats.closeableCount, totalRentSOL: newStats.totalRentSOL }
                    )

                    if (alertMessage) {
                        // Send alert to all users tracking this address
                        for (const chatId of chatIds) {
                            const userPrefs = await getUserPrefs(chatId)
                            if (userPrefs.alertsEnabled) {
                                try {
                                    await bot.api.sendMessage(chatId, alertMessage, { parse_mode: 'Markdown' })
                                    alertsSent++
                                } catch (sendError) {
                                    console.error(`Failed to send alert to ${chatId}:`, sendError)
                                }
                            }
                        }
                    }
                }

                // Cache new results
                await setCachedScan(address, newStats)
                scannedCount++

            } catch (scanError) {
                console.error(`Failed to scan ${address}:`, scanError)
            }
        }

        console.log(`✅ Cron complete: ${scannedCount} addresses scanned, ${alertsSent} alerts sent`)

        return res.status(200).json({
            message: 'Cron job completed',
            scanned: scannedCount,
            alertsSent,
            timestamp: new Date().toISOString(),
        })

    } catch (error: any) {
        console.error('Cron job error:', error)
        return res.status(500).json({ error: error.message || 'Internal server error' })
    }
}
