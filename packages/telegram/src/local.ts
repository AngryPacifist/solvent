// Local testing script - uses long-polling instead of webhooks
// Run with: npx tsx src/local.ts

import { config } from 'dotenv'
config({ path: '.env.local' })

import { Bot, Context, InlineKeyboard } from 'grammy'
import {
    getUserPrefs,
    setUserPrefs,
    getTrackedAddresses,
    trackAddress,
    untrackAddress,
    getConversationState,
    setConversationState,
    type ConversationState
} from './services/redis.js'
import { performScan, formatScanMessage, formatStatusMessage } from './services/scanner.js'

// Helper functions for conversation state (async wrappers for Redis)
async function getState(chatId: number): Promise<ConversationState> {
    return await getConversationState(chatId)
}

async function setState(chatId: number, state: ConversationState): Promise<void> {
    await setConversationState(chatId, state)
}

// Initialize bot
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!)

// Global error handler - prevents crashes on callback errors
bot.catch((err) => {
    const ctx = err.ctx
    console.error(`Error handling update ${ctx.update.update_id}:`)
    const e = err.error
    if (e instanceof Error) {
        console.error('Error:', e.message)
        // Don't crash on "query ID is invalid" errors (expired callbacks)
        if (e.message.includes('query') || e.message.includes('expired')) {
            console.log('Ignoring expired callback query error')
            return
        }
    } else {
        console.error('Unknown error:', e)
    }
})

// /start command with inline keyboard
bot.command('start', async (ctx: Context) => {
    const keyboard = new InlineKeyboard()
        .text('📊 Scan Address', 'action:scan')
        .text('📋 My Tracked', 'action:list')
        .row()
        .text('⚙️ Settings', 'action:settings')
        .text('❓ Help', 'action:help')

    const welcomeMessage = `
🧪 *Welcome to Solvent Bot!*

I help Kora operators monitor and reclaim rent from sponsored accounts.

*Quick Start:*
1️⃣ Use /scan <address> to check a fee payer
2️⃣ Use /track <address> to monitor it
3️⃣ Get alerts when accounts become closeable!

_Built for the Superteam Nigeria Kora Bounty_
`
    await ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    })
})

// Settings callback
bot.callbackQuery('action:settings', async (ctx) => {
    const prefs = await getUserPrefs(ctx.chat!.id)
    const networkDisplay = prefs.network === 'mainnet-beta' ? 'mainnet' : 'devnet'
    const alertsStatus = prefs.alertsEnabled ? 'ON' : 'OFF'
    const rpcStatus = prefs.customRpc ? `Custom` : 'Default'

    const keyboard = new InlineKeyboard()
        .text(`🌐 Network: ${networkDisplay}`, 'toggle:network')
        .row()
        .text(`🔔 Alerts: ${alertsStatus}`, 'toggle:alerts')
        .row()
        .text(`🔗 RPC: ${rpcStatus}`, 'show:rpc')
        .row()
        .text('« Back', 'action:start')

    await ctx.editMessageText(`
⚙️ *Settings*

🌐 *Network:* ${networkDisplay}
🔔 *Alerts:* ${alertsStatus}
🔗 *Custom RPC:* ${prefs.customRpc || 'Not set (using default)'}

_Tap a button to change settings_
`, { parse_mode: 'Markdown', reply_markup: keyboard })
    await ctx.answerCallbackQuery()
})

// Toggle network callback
bot.callbackQuery('toggle:network', async (ctx) => {
    const prefs = await getUserPrefs(ctx.chat!.id)
    const newNetwork = prefs.network === 'devnet' ? 'mainnet-beta' : 'devnet'
    await setUserPrefs(ctx.chat!.id, { network: newNetwork })

    const networkDisplay = newNetwork === 'mainnet-beta' ? 'mainnet' : 'devnet'
    const emoji = newNetwork === 'mainnet-beta' ? '🟢' : '🔵'
    await ctx.answerCallbackQuery({ text: `${emoji} Switched to ${networkDisplay}` })

    // Refresh settings view
    const keyboard = new InlineKeyboard()
        .text(`🌐 Network: ${networkDisplay}`, 'toggle:network')
        .row()
        .text(`🔔 Alerts: ${prefs.alertsEnabled ? 'ON' : 'OFF'}`, 'toggle:alerts')
        .row()
        .text(`🔗 RPC: ${prefs.customRpc ? 'Custom' : 'Default'}`, 'show:rpc')
        .row()
        .text('« Back', 'action:start')

    await ctx.editMessageText(`
⚙️ *Settings*

🌐 *Network:* ${networkDisplay}
🔔 *Alerts:* ${prefs.alertsEnabled ? 'ON' : 'OFF'}
🔗 *Custom RPC:* ${prefs.customRpc || 'Not set (using default)'}

_Tap a button to change settings_
`, { parse_mode: 'Markdown', reply_markup: keyboard })
})

// Toggle alerts callback
bot.callbackQuery('toggle:alerts', async (ctx) => {
    const prefs = await getUserPrefs(ctx.chat!.id)
    const newAlerts = !prefs.alertsEnabled
    await setUserPrefs(ctx.chat!.id, { alertsEnabled: newAlerts })

    const status = newAlerts ? 'ON 🔔' : 'OFF 🔕'
    await ctx.answerCallbackQuery({ text: `Alerts ${status}` })

    // Refresh settings view
    const networkDisplay = prefs.network === 'mainnet-beta' ? 'mainnet' : 'devnet'
    const keyboard = new InlineKeyboard()
        .text(`🌐 Network: ${networkDisplay}`, 'toggle:network')
        .row()
        .text(`🔔 Alerts: ${newAlerts ? 'ON' : 'OFF'}`, 'toggle:alerts')
        .row()
        .text(`🔗 RPC: ${prefs.customRpc ? 'Custom' : 'Default'}`, 'show:rpc')
        .row()
        .text('« Back', 'action:start')

    await ctx.editMessageText(`
⚙️ *Settings*

🌐 *Network:* ${networkDisplay}
🔔 *Alerts:* ${newAlerts ? 'ON' : 'OFF'}
🔗 *Custom RPC:* ${prefs.customRpc || 'Not set (using default)'}

_Tap a button to change settings_
`, { parse_mode: 'Markdown', reply_markup: keyboard })
})

// Show RPC info callback
bot.callbackQuery('show:rpc', async (ctx) => {
    const prefs = await getUserPrefs(ctx.chat!.id)

    const keyboard = new InlineKeyboard()
        .text('✏️ Set Custom RPC', 'set:rpc')
        .row()
        .text('🗑️ Clear (Use Default)', 'clear:rpc')
        .row()
        .text('« Back to Settings', 'action:settings')

    const rpcDisplay = prefs.customRpc
        ? `\`${prefs.customRpc}\``
        : '_Not set (using default)_'

    await ctx.editMessageText(`
🔗 *Custom RPC Configuration*

*Current RPC:*
${rpcDisplay}

_Tap "Set Custom RPC" to enter a new URL_
`, { parse_mode: 'Markdown', reply_markup: keyboard })
    await ctx.answerCallbackQuery()
})

// Set RPC callback - prompts for input
bot.callbackQuery('set:rpc', async (ctx) => {
    await ctx.answerCallbackQuery()
    await setState(ctx.chat!.id, 'waiting_rpc')

    const keyboard = new InlineKeyboard().text('❌ Cancel', 'action:cancel')

    await ctx.reply('📤 *Send me your RPC URL:*\n\n_Example: https://api.mainnet-beta.solana.com_', {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    })
})

// Clear RPC callback
bot.callbackQuery('clear:rpc', async (ctx) => {
    await setUserPrefs(ctx.chat!.id, { customRpc: null })
    await ctx.answerCallbackQuery({ text: '✅ Custom RPC cleared' })

    // Go back to settings
    const prefs = await getUserPrefs(ctx.chat!.id)
    const networkDisplay = prefs.network === 'mainnet-beta' ? 'mainnet' : 'devnet'

    const keyboard = new InlineKeyboard()
        .text(`🌐 Network: ${networkDisplay}`, 'toggle:network')
        .row()
        .text(`🔔 Alerts: ${prefs.alertsEnabled ? 'ON' : 'OFF'}`, 'toggle:alerts')
        .row()
        .text(`🔗 RPC: Default`, 'show:rpc')
        .row()
        .text('« Back', 'action:start')

    await ctx.editMessageText(`
⚙️ *Settings*

🌐 *Network:* ${networkDisplay}
🔔 *Alerts:* ${prefs.alertsEnabled ? 'ON' : 'OFF'}
🔗 *Custom RPC:* Not set (using default)

_Tap a button to change settings_
`, { parse_mode: 'Markdown', reply_markup: keyboard })
})

// Action callbacks
bot.callbackQuery('action:scan', async (ctx) => {
    await ctx.answerCallbackQuery()
    await setState(ctx.chat!.id, 'waiting_scan')

    const keyboard = new InlineKeyboard()
        .text('❌ Cancel', 'action:cancel')

    await ctx.reply('📤 *Send me a Solana address to scan:*\n\n_Just paste the address, no command needed!_', {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    })
})

// Cancel action
bot.callbackQuery('action:cancel', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Cancelled' })
    await setState(ctx.chat!.id, 'idle')
    await ctx.reply('✅ Cancelled. Use /start to see the menu.')
})

bot.callbackQuery('action:list', async (ctx) => {
    await ctx.answerCallbackQuery()
    const addresses = await getTrackedAddresses(ctx.chat!.id)

    if (addresses.length === 0) {
        await ctx.reply('📭 No tracked addresses.\n\nUse /track <address> to start!')
        return
    }

    let message = `📋 *Tracked Addresses (${addresses.length}):*\n\n`
    addresses.forEach((addr, i) => {
        const shortAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`
        message += `${i + 1}. \`${shortAddr}\`\n`
    })

    const keyboard = new InlineKeyboard()
        .text('📊 Get Status', 'action:status')

    await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: keyboard })
})

bot.callbackQuery('action:status', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Fetching status...' })
    const addresses = await getTrackedAddresses(ctx.chat!.id)

    if (addresses.length === 0) {
        await ctx.reply('📭 No tracked addresses.')
        return
    }

    try {
        const prefs = await getUserPrefs(ctx.chat!.id)
        const scans = await Promise.all(
            addresses.map(addr => performScan(addr, prefs.network, prefs.customRpc))
        )
        const message = formatStatusMessage(scans)
        await ctx.reply(message, { parse_mode: 'Markdown' })
    } catch (error: any) {
        await ctx.reply(`❌ Status check failed: ${error.message || 'Unknown error'}`)
    }
})

bot.callbackQuery('action:help', async (ctx) => {
    await ctx.answerCallbackQuery()
    await ctx.reply(`
🧪 *Solvent Bot Commands*

/scan <address> - Scan a fee payer address
/track <address> - Track for auto-alerts
/untrack <address> - Stop tracking
/status - Summary of all tracked
/list - List tracked addresses
/alerts on|off - Toggle alerts
/network devnet|mainnet - Switch network
/rpc <url> - Set custom RPC
/rpc clear - Use default RPC

_Need help? Visit github.com/AngryPacifist/solvent_
`, { parse_mode: 'Markdown' })
})

bot.callbackQuery('action:start', async (ctx) => {
    await ctx.answerCallbackQuery()
    const keyboard = new InlineKeyboard()
        .text('📊 Scan Address', 'action:scan')
        .text('📋 My Tracked', 'action:list')
        .row()
        .text('⚙️ Settings', 'action:settings')
        .text('❓ Help', 'action:help')

    await ctx.editMessageText(`
🧪 *Welcome to Solvent Bot!*

I help Kora operators monitor and reclaim rent from sponsored accounts.

*Quick Start:*
1️⃣ Use /scan <address> to check a fee payer
2️⃣ Use /track <address> to monitor it
3️⃣ Get alerts when accounts become closeable!

_Built for the Superteam Nigeria Kora Bounty_
`, { parse_mode: 'Markdown', reply_markup: keyboard })
})

// /help command
bot.command('help', async (ctx: Context) => {
    await ctx.reply(`
🧪 *Solvent Bot Commands*

/scan <address> - Scan a fee payer address
/track <address> - Track for auto-alerts
/untrack <address> - Stop tracking
/status - Summary of all tracked
/list - List tracked addresses
/alerts on|off - Toggle alerts
/network devnet|mainnet - Switch network
/rpc <url> - Set custom RPC

_Need help? Visit github.com/AngryPacifist/solvent_
`, { parse_mode: 'Markdown' })
})

// /rpc command
bot.command('rpc', async (ctx: Context) => {
    const args = ctx.message?.text?.split(' ').slice(1)
    const rpcUrl = args?.join(' ')

    if (!rpcUrl) {
        const prefs = await getUserPrefs(ctx.chat!.id)
        const rpcDisplay = prefs.customRpc ? `\`${prefs.customRpc}\`` : '_Not set (using default)_'

        const keyboard = new InlineKeyboard()
            .text('✏️ Set Custom RPC', 'set:rpc')
            .row()
            .text('🗑️ Clear (Use Default)', 'clear:rpc')

        await ctx.reply(`
🔗 *Custom RPC Settings*

*Current RPC:*
${rpcDisplay}

_Tap "Set Custom RPC" to enter a URL_
`, { parse_mode: 'Markdown', reply_markup: keyboard })
        return
    }

    if (rpcUrl.toLowerCase() === 'clear') {
        await setUserPrefs(ctx.chat!.id, { customRpc: null })
        await ctx.reply('✅ Custom RPC cleared. Using default RPC.')
        return
    }

    // Basic URL validation
    if (!rpcUrl.startsWith('http://') && !rpcUrl.startsWith('https://')) {
        await ctx.reply('❌ Invalid RPC URL. Must start with http:// or https://')
        return
    }

    await setUserPrefs(ctx.chat!.id, { customRpc: rpcUrl })
    await ctx.reply(`✅ Custom RPC set!\n\n🔗 \`${rpcUrl}\``, { parse_mode: 'Markdown' })
})

// /scan command with track button
bot.command('scan', async (ctx: Context) => {
    const args = ctx.message?.text?.split(' ').slice(1)
    const address = args?.[0]

    if (!address) {
        await setState(ctx.chat!.id, 'waiting_scan')
        const keyboard = new InlineKeyboard().text('❌ Cancel', 'action:cancel')
        await ctx.reply('📤 *Send me a Solana address to scan:*', { parse_mode: 'Markdown', reply_markup: keyboard })
        return
    }

    if (address.length < 32 || address.length > 44) {
        await ctx.reply('❌ Invalid address format. Please provide a valid Solana address.')
        return
    }

    await ctx.reply('🔍 Scanning... this may take a moment.')

    try {
        const prefs = await getUserPrefs(ctx.chat!.id)
        const result = await performScan(address, prefs.network, prefs.customRpc)
        const message = formatScanMessage(result)

        // Add action buttons after scan
        const keyboard = new InlineKeyboard()
            .text('📌 Track This Address', `track:${address}`)
            .row()
            .text('🔄 Scan Again', `rescan:${address}`)

        await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: keyboard })
    } catch (error: any) {
        console.error('Scan error:', error)
        await ctx.reply(`❌ Scan failed: ${error.message || 'Unknown error'}`)
    }
})

// Track from button callback
bot.callbackQuery(/^track:(.+)$/, async (ctx) => {
    const address = ctx.match![1]
    const added = await trackAddress(ctx.chat!.id, address)
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`

    if (added) {
        await ctx.answerCallbackQuery({ text: `✅ Now tracking ${shortAddr}` })
    } else {
        await ctx.answerCallbackQuery({ text: `ℹ️ Already tracking ${shortAddr}` })
    }
})

// Rescan from button callback
bot.callbackQuery(/^rescan:(.+)$/, async (ctx) => {
    const address = ctx.match![1]
    await ctx.answerCallbackQuery({ text: '🔍 Rescanning...' })

    try {
        const prefs = await getUserPrefs(ctx.chat!.id)
        const result = await performScan(address, prefs.network, prefs.customRpc)
        const message = formatScanMessage(result)

        const keyboard = new InlineKeyboard()
            .text('📌 Track This Address', `track:${address}`)
            .row()
            .text('🔄 Scan Again', `rescan:${address}`)

        await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: keyboard })
    } catch (error: any) {
        await ctx.reply(`❌ Rescan failed: ${error.message || 'Unknown error'}`)
    }
})

// /track command
bot.command('track', async (ctx: Context) => {
    const args = ctx.message?.text?.split(' ').slice(1)
    const address = args?.[0]

    if (!address) {
        await setState(ctx.chat!.id, 'waiting_track')
        const keyboard = new InlineKeyboard().text('❌ Cancel', 'action:cancel')
        await ctx.reply('📤 *Send me the address to track:*', { parse_mode: 'Markdown', reply_markup: keyboard })
        return
    }

    if (address.length < 32 || address.length > 44) {
        await ctx.reply('❌ Invalid address format.')
        return
    }

    const added = await trackAddress(ctx.chat!.id, address)
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`

    if (added) {
        const prefs = await getUserPrefs(ctx.chat!.id)
        const networkDisplay = prefs.network === 'mainnet-beta' ? 'mainnet' : 'devnet'

        const keyboard = new InlineKeyboard()
            .text('📊 Scan Now', `rescan:${address}`)
            .text('📋 View All', 'action:list')

        await ctx.reply(`✅ Now tracking \`${shortAddr}\` on ${networkDisplay}\n\nYou'll receive alerts when closeable accounts are detected.`, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        })
    } else {
        await ctx.reply(`ℹ️ Address \`${shortAddr}\` is already being tracked.`, { parse_mode: 'Markdown' })
    }
})

// /untrack command
bot.command('untrack', async (ctx: Context) => {
    const args = ctx.message?.text?.split(' ').slice(1)
    const address = args?.[0]

    if (!address) {
        await setState(ctx.chat!.id, 'waiting_untrack')
        const keyboard = new InlineKeyboard().text('❌ Cancel', 'action:cancel')
        await ctx.reply('📤 *Send me the address to untrack:*', { parse_mode: 'Markdown', reply_markup: keyboard })
        return
    }

    const removed = await untrackAddress(ctx.chat!.id, address)
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`

    if (removed) {
        // Use copy_text button to copy full address
        await ctx.reply(`✅ Stopped tracking \`${shortAddr}\``, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '📋 Copy Full Address', copy_text: { text: address } }]]
            }
        })
    } else {
        await ctx.reply(`ℹ️ Address \`${shortAddr}\` was not being tracked.`, { parse_mode: 'Markdown' })
    }
})

// /list command
bot.command('list', async (ctx: Context) => {
    const addresses = await getTrackedAddresses(ctx.chat!.id)

    if (addresses.length === 0) {
        await ctx.reply('📭 No tracked addresses.\n\nUse /track <address> to start!')
        return
    }

    let message = `📋 *Tracked Addresses (${addresses.length}):*\n\n`
    addresses.forEach((addr, i) => {
        const shortAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`
        message += `${i + 1}. \`${shortAddr}\`\n`
    })

    const keyboard = new InlineKeyboard()
        .text('📊 Get Full Status', 'action:status')

    await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: keyboard })
})

// /status command
bot.command('status', async (ctx: Context) => {
    const addresses = await getTrackedAddresses(ctx.chat!.id)

    if (addresses.length === 0) {
        await ctx.reply('📭 No tracked addresses.\n\nUse /track <address> to start!')
        return
    }

    await ctx.reply('📊 Fetching status for all tracked addresses...')

    try {
        const prefs = await getUserPrefs(ctx.chat!.id)
        const scans = await Promise.all(
            addresses.map(addr => performScan(addr, prefs.network, prefs.customRpc))
        )
        const message = formatStatusMessage(scans)
        await ctx.reply(message, { parse_mode: 'Markdown' })
    } catch (error: any) {
        await ctx.reply(`❌ Status check failed: ${error.message || 'Unknown error'}`)
    }
})

// /alerts command
bot.command('alerts', async (ctx: Context) => {
    const args = ctx.message?.text?.split(' ').slice(1)
    const setting = args?.[0]?.toLowerCase()

    if (setting === 'on') {
        await setUserPrefs(ctx.chat!.id, { alertsEnabled: true })
        await ctx.reply('🔔 Alerts *enabled*. You\'ll be notified of new closeable accounts.', { parse_mode: 'Markdown' })
    } else if (setting === 'off') {
        await setUserPrefs(ctx.chat!.id, { alertsEnabled: false })
        await ctx.reply('🔕 Alerts *disabled*.', { parse_mode: 'Markdown' })
    } else {
        const prefs = await getUserPrefs(ctx.chat!.id)
        const status = prefs.alertsEnabled ? 'enabled 🔔' : 'disabled 🔕'
        await ctx.reply(`Alerts are currently *${status}*\n\nUse \`/alerts on\` or \`/alerts off\` to change.`, { parse_mode: 'Markdown' })
    }
})

// /network command
bot.command('network', async (ctx: Context) => {
    const args = ctx.message?.text?.split(' ').slice(1)
    const networkArg = args?.[0]?.toLowerCase()

    if (networkArg === 'devnet' || networkArg === 'mainnet') {
        const network = networkArg === 'mainnet' ? 'mainnet-beta' : 'devnet'
        await setUserPrefs(ctx.chat!.id, { network })
        const emoji = networkArg === 'mainnet' ? '🟢' : '🔵'
        await ctx.reply(`${emoji} Network set to *${networkArg}*`, { parse_mode: 'Markdown' })
    } else {
        const prefs = await getUserPrefs(ctx.chat!.id)
        const networkDisplay = prefs.network === 'mainnet-beta' ? 'mainnet' : 'devnet'
        const emoji = prefs.network === 'mainnet-beta' ? '🟢' : '🔵'
        await ctx.reply(`${emoji} Current network: *${networkDisplay}*\n\nUse \`/network devnet\` or \`/network mainnet\``, { parse_mode: 'Markdown' })
    }
})

// Text message handler - checks conversation state
bot.on('message:text', async (ctx: Context) => {
    const text = ctx.message?.text?.trim()
    if (!text) return

    // Check if it's a command
    if (text.startsWith('/')) {
        // Reset state on new command
        await setState(ctx.chat!.id, 'idle')
        // Let command handlers handle it - if unknown, show help
        return
    }

    const state = await getState(ctx.chat!.id)

    // Handle waiting_scan state
    if (state === 'waiting_scan') {
        const address = text

        // Validate address
        if (address.length < 32 || address.length > 44) {
            await ctx.reply('❌ Invalid address format. Please send a valid Solana address (32-44 characters).')
            return
        }

        // Reset state
        await setState(ctx.chat!.id, 'idle')

        await ctx.reply('🔍 Scanning... this may take a moment.')

        try {
            const prefs = await getUserPrefs(ctx.chat!.id)
            const result = await performScan(address, prefs.network, prefs.customRpc)
            const message = formatScanMessage(result)

            const keyboard = new InlineKeyboard()
                .text('📌 Track This Address', `track:${address}`)
                .row()
                .text('🔄 Scan Again', `rescan:${address}`)

            await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: keyboard })
        } catch (error: any) {
            console.error('Scan error:', error)
            await ctx.reply(`❌ Scan failed: ${error.message || 'Unknown error'}`)
        }
        return
    }

    // Handle waiting_rpc state
    if (state === 'waiting_rpc') {
        const rpcUrl = text

        if (!rpcUrl.startsWith('http://') && !rpcUrl.startsWith('https://')) {
            await ctx.reply('❌ Invalid RPC URL. Must start with http:// or https://')
            return
        }

        await setState(ctx.chat!.id, 'idle')
        await setUserPrefs(ctx.chat!.id, { customRpc: rpcUrl })
        await ctx.reply(`✅ Custom RPC set!\n\n🔗 \`${rpcUrl}\``, { parse_mode: 'Markdown' })
        return
    }

    // Handle waiting_track state
    if (state === 'waiting_track') {
        const address = text

        if (address.length < 32 || address.length > 44) {
            await ctx.reply('❌ Invalid address format. Please send a valid Solana address.')
            return
        }

        await setState(ctx.chat!.id, 'idle')
        const added = await trackAddress(ctx.chat!.id, address)
        const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`

        if (added) {
            const prefs = await getUserPrefs(ctx.chat!.id)
            const networkDisplay = prefs.network === 'mainnet-beta' ? 'mainnet' : 'devnet'
            await ctx.reply(`✅ Now tracking \`${shortAddr}\` on ${networkDisplay}`, { parse_mode: 'Markdown' })
        } else {
            await ctx.reply(`ℹ️ Already tracking \`${shortAddr}\``, { parse_mode: 'Markdown' })
        }
        return
    }

    // Handle waiting_untrack state
    if (state === 'waiting_untrack') {
        const address = text

        if (address.length < 32 || address.length > 44) {
            await ctx.reply('❌ Invalid address format. Please send a valid Solana address.')
            return
        }

        await setState(ctx.chat!.id, 'idle')
        const removed = await untrackAddress(ctx.chat!.id, address)
        const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`

        if (removed) {
            await ctx.reply(`✅ Stopped tracking \`${shortAddr}\``, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '📋 Copy Full Address', copy_text: { text: address } }]]
                }
            })
        } else {
            await ctx.reply(`ℹ️ Address \`${shortAddr}\` was not being tracked.`, { parse_mode: 'Markdown' })
        }
        return
    }

    // If not in any state and not a command, suggest using menu
    await ctx.reply('💡 Use the /start command to see the menu, or type a command like /scan or /help')
})

// Set up command menu (the "/" button in Telegram)
async function setupCommands() {
    await bot.api.setMyCommands([
        { command: 'start', description: '🏠 Start the bot' },
        { command: 'scan', description: '🔍 Scan a fee payer address' },
        { command: 'track', description: '📌 Track an address for alerts' },
        { command: 'untrack', description: '🗑️ Stop tracking an address' },
        { command: 'status', description: '📊 View status of tracked addresses' },
        { command: 'list', description: '📋 List tracked addresses' },
        { command: 'alerts', description: '🔔 Toggle alert notifications' },
        { command: 'network', description: '🌐 Switch network (devnet/mainnet)' },
        { command: 'rpc', description: '🔗 Set custom RPC URL' },
        { command: 'help', description: '❓ Show help' },
    ])
    console.log('📋 Command menu registered with Telegram')
}

// Start bot with long-polling (for local testing)
console.log('🧪 Solvent Bot starting in long-polling mode...')
console.log('📡 Connecting to Telegram...')

setupCommands().then(() => {
    bot.start({
        onStart: () => {
            console.log('✅ Bot is running! Send /start to your bot on Telegram.')
        }
    })
})
