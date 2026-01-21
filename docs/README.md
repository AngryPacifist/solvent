# Solvent Documentation

Welcome to the Solvent documentation. Solvent is a rent monitoring and reclaim toolkit for Kora operators on Solana.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Getting Started](./getting-started.md) | Installation, setup, and quick start guide |
| [CLI Reference](./cli-reference.md) | Complete command-line interface documentation |
| [Telegram Bot](./telegram-bot.md) | Setting up and deploying the Telegram bot |
| [Dashboard](./dashboard.md) | Web dashboard deployment and usage |
| [Core Library API](./core-api.md) | Using the @solvent/core library in your own projects |
| [Understanding Rent](./understanding-rent.md) | How Solana rent works and how Solvent helps reclaim it |
| [Deployment Guide](./deployment.md) | Deploying Solvent components to production |

## Quick Links

- **Source Code**: [GitHub Repository](https://github.com/AngryPacifist/solvent)
- **npm Package**: [@angrypacifist/solvent-core](https://www.npmjs.com/package/@angrypacifist/solvent-core)
- **Telegram Bot**: [@SolventReclaimBot](https://t.me/solvent_rent_bot)

## What is Solvent?

When Kora sponsors transactions that create accounts (like ATAs), rent SOL gets locked in those accounts. Solvent helps operators:

1. **Scan** fee payer transaction history
2. **Identify** sponsored account creations
3. **Classify** accounts as RECLAIMABLE or MONITOR-ONLY
4. **Reclaim** rent from closeable accounts (when you have authority)
5. **Alert** about accounts requiring manual action

## Interfaces

Solvent provides four interfaces:

| Interface | Best For |
|-----------|----------|
| **CLI** | Operators who prefer command-line tools |
| **Dashboard** | Visual monitoring and quick account checks |
| **Telegram Bot** | Alerts and mobile-friendly scanning |
| **Core Library** | Building custom integrations |
