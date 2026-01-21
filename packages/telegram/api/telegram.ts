import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleUpdate } from '../src/bot.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only accept POST requests from Telegram
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        // Convert Vercel request to standard Request for grammy
        const body = JSON.stringify(req.body)
        const headers = new Headers()
        Object.entries(req.headers).forEach(([key, value]) => {
            if (value) headers.set(key, Array.isArray(value) ? value[0] : value)
        })

        const request = new Request(`https://${req.headers.host}${req.url}`, {
            method: 'POST',
            headers,
            body,
        })

        // Process the update
        const response = await handleUpdate(request)

        // Return response
        res.status(response.status)
        const responseText = await response.text()
        if (responseText) {
            res.send(responseText)
        } else {
            res.end()
        }
    } catch (error: any) {
        console.error('Telegram webhook error:', error)
        res.status(500).json({ error: error.message || 'Internal server error' })
    }
}
