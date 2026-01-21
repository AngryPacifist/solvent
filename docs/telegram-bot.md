# Telegram Bot

The Solvent Telegram Bot provides mobile-friendly monitoring, scanning, and alerts for Kora operators.

## Features

- **Inline Keyboards** - Tap buttons instead of typing commands
- **Address Tracking** - Monitor multiple fee payers
- **Scheduled Alerts** - Get notified when new closeable accounts appear
- **Custom RPC** - Use your own RPC endpoint
- **Network Switching** - Toggle between devnet and mainnet

## Using the Bot

### Basic Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome menu with buttons |
| `/scan <address>` | Scan a fee payer address |
| `/track <address>` | Start tracking an address |
| `/untrack <address>` | Stop tracking an address |
| `/list` | List all tracked addresses |
| `/status` | Get status summary of all tracked |
| `/help` | Show help message |

### Settings Commands

| Command | Description |
|---------|-------------|
| `/network devnet` | Switch to devnet |
| `/network mainnet` | Switch to mainnet |
| `/rpc <url>` | Set custom RPC URL |
| `/rpc clear` | Clear custom RPC, use default |
| `/alerts on` | Enable alert notifications |
| `/alerts off` | Disable alert notifications |

## Self-Hosting the Bot

### Requirements

1. **Telegram Bot Token** - Create a bot via [@BotFather](https://t.me/BotFather)
2. **Upstash Redis** - For user preferences and tracking state
3. **Vercel Account** - For deployment (free tier works)

### Environment Variables

Create `.env.local` in `packages/telegram`:

```env
# From @BotFather
TELEGRAM_BOT_TOKEN=your_bot_token_here

# From Upstash dashboard
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here

# Generate a random 32+ character string
CRON_SECRET=your_random_secret_here
```

### Local Testing

```bash
cd packages/telegram
cp .env.example .env.local
# Edit .env.local with your values
npx tsx src/local.ts
```

The local script uses long-polling instead of webhooks.

### Deploying to Vercel

1. **Deploy the package:**
   ```bash
   cd packages/telegram
   npx vercel --prod
   ```

2. **Set environment variables in Vercel:**
   - Go to your project settings in Vercel dashboard
   - Add the same environment variables from `.env.local`

3. **Set up the webhook:**
   ```bash
   curl "https://your-deployment.vercel.app/api/setup?secret=YOUR_CRON_SECRET"
   ```

4. **Verify it's working:**
   - Message your bot with `/start`
   - You should see the welcome message with inline buttons

### Setting Up Scheduled Scans

For automated alerts when new closeable accounts are detected:

1. Go to [cron-job.org](https://cron-job.org) (free)
2. Create a new cron job:
   - **URL:** `https://your-deployment.vercel.app/api/cron`
   - **Method:** GET or POST
   - **Header:** `Authorization: Bearer YOUR_CRON_SECRET`
   - **Schedule:** Every 3 hours (or your preference)

Alternatively, use the URL query parameter:
- **URL:** `https://your-deployment.vercel.app/api/cron?secret=YOUR_CRON_SECRET`

### How Alerts Work

1. Users `/track` addresses they want to monitor
2. The cron job runs every 3 hours
3. For each tracked address, it scans for closeable accounts
4. It compares with cached previous scan results
5. If new closeable accounts are detected, it sends an alert message

Alert messages include:
- Number of new closeable accounts
- Total closeable count
- Total reclaimable rent

## Architecture

```
packages/telegram/
├── api/                    # Vercel serverless functions
│   ├── telegram.ts         # Webhook handler
│   ├── cron.ts             # Scheduled scan job
│   └── setup.ts            # Webhook setup endpoint
├── src/
│   ├── bot.ts              # Main bot logic (webhook mode)
│   ├── local.ts            # Local testing (long-polling)
│   └── services/
│       ├── redis.ts        # User prefs, tracking, caching
│       └── scanner.ts      # Core library wrapper
└── .env.example            # Environment template
```

## Redis Data Structure

| Key Pattern | Type | Purpose |
|-------------|------|---------|
| `user:<chatId>` | Hash | User preferences |
| `tracked:<chatId>` | Set | Tracked addresses |
| `cache:<address>` | Hash | Cached scan results (1h TTL) |
| `state:<chatId>` | String | Conversation state (5m TTL) |

## Customizing the Bot

### Adding Commands

Edit `src/bot.ts` and add new handlers:

```typescript
bot.command('mycommand', async (ctx) => {
    await ctx.reply('Response')
})
```

### Adding Callback Buttons

```typescript
// In command handler
const keyboard = new InlineKeyboard()
    .text('Button Text', 'callback:data')

await ctx.reply('Message', { reply_markup: keyboard })

// Handle callback
bot.callbackQuery('callback:data', async (ctx) => {
    await ctx.answerCallbackQuery()
    // Handle action
})
```

### Modifying Alert Format

Edit `formatAlertMessage` in `src/services/scanner.ts`.
