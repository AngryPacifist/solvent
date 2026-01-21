import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Bot } from 'grammy'

// Utility endpoint to set the Telegram webhook URL
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    // Check for setup secret
    const secret = req.query.secret
    if (secret !== process.env.CRON_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    try {
        const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!)

        // Get the host from request or environment
        const host = req.headers.host || process.env.VERCEL_URL
        if (!host) {
            return res.status(400).json({ error: 'Could not determine host' })
        }

        const webhookUrl = `https://${host}/api/telegram`

        // Set the webhook
        await bot.api.setWebhook(webhookUrl, {
            drop_pending_updates: true,
        })

        // Get webhook info to confirm
        const info = await bot.api.getWebhookInfo()

        return res.status(200).json({
            message: 'Webhook set successfully',
            url: webhookUrl,
            info: {
                url: info.url,
                pending_update_count: info.pending_update_count,
                has_custom_certificate: info.has_custom_certificate,
            }
        })
    } catch (error: any) {
        console.error('Setup webhook error:', error)
        return res.status(500).json({ error: error.message || 'Failed to set webhook' })
    }
}
