# Deployment Guide

This guide covers deploying Solvent components to production.

## Overview

| Component | Platform | URL |
|-----------|----------|-----|
| Dashboard | Vercel | your-dashboard.vercel.app |
| Telegram Bot | Vercel | your-bot.vercel.app |
| Core Library | npm | @angrypacifist/solvent-core |

## Dashboard Deployment

### Deploy to Vercel

```bash
cd packages/dashboard
npx vercel --prod
```

The `vercel.json` is preconfigured to:
1. Install dependencies from monorepo root
2. Build core library first
3. Build dashboard
4. Serve from `dist` directory

### Environment Variables

The dashboard requires no environment variables for basic operation. It uses user-provided addresses and public RPCs.

Optional variables:
- `VITE_DEVNET_RPC` - Custom devnet RPC
- `VITE_MAINNET_RPC` - Custom mainnet RPC

## Telegram Bot Deployment

### 1. Prerequisites

- Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- Upstash Redis database

### 2. Environment Variables

Set in Vercel dashboard:

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `CRON_SECRET` | Random 32+ char string for auth |

### 3. Deploy

```bash
cd packages/telegram
npx vercel --prod
```

### 4. Set Up Webhook

After deployment, register the webhook:

```bash
curl "https://your-deployment.vercel.app/api/setup?secret=YOUR_CRON_SECRET"
```

### 5. Set Up Cron Job (Optional)

For automated alerts, use [cron-job.org](https://cron-job.org):

- **URL:** `https://your-deployment.vercel.app/api/cron`
- **Header:** `Authorization: Bearer YOUR_CRON_SECRET`
- **Schedule:** Every 3 hours

## Core Library Publishing

### 1. Update Version

Edit `packages/core/package.json`:

```json
{
  "version": "1.0.1"
}
```

### 2. Build

```bash
cd packages/core
npm run build
```

### 3. Publish

```bash
npm publish --access public
```

## Production Checklist

### Dashboard
- [ ] Custom domain configured (optional)
- [ ] Works with mainnet RPC

### Telegram Bot
- [ ] Bot token is production bot
- [ ] Redis is production database
- [ ] Webhook is registered
- [ ] Cron job is configured
- [ ] Alerts are working

### Security
- [ ] CRON_SECRET is unique and secret
- [ ] No sensitive data in git
- [ ] .env files are gitignored

## Monitoring

### Telegram Bot Logs

View logs in Vercel dashboard:
1. Go to your project
2. Click "Deployments"
3. Click "Functions" tab
4. View logs for `api/telegram` and `api/cron`

### Cron Job Results

The cron endpoint returns:

```json
{
  "message": "Cron job completed",
  "scanned": 5,
  "alertsSent": 2
}
```

## Troubleshooting

### Bot Not Responding

1. Check webhook is registered:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```

2. Verify environment variables in Vercel

3. Check Vercel function logs

### Cron Not Working

1. Test manually:
   ```bash
   curl -H "Authorization: Bearer YOUR_SECRET" \
     "https://your-deployment.vercel.app/api/cron"
   ```

2. Check cron-job.org logs

3. Verify CRON_SECRET matches

### Dashboard Scan Failing

1. Check browser console for errors
2. Try a different RPC if rate limited
3. Verify address format is correct

## Cost Estimates

All components can run on free tiers:

| Service | Free Tier |
|---------|-----------|
| Vercel | 100GB bandwidth/month |
| Upstash Redis | 10,000 commands/day |
| cron-job.org | Unlimited cron jobs |
