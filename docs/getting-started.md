# Getting Started

This guide walks you through installing and running Solvent.

## Prerequisites

- **Node.js** 18 or higher
- **npm** 9 or higher

## Installation

### Clone the Repository

```bash
git clone https://github.com/AngryPacifist/solvent
cd solvent
```

### Install Dependencies

```bash
npm install
```

### Build All Packages

```bash
npm run build
```

This builds the monorepo in the correct order:
1. `@solvent/core` - shared library
2. `@solvent/cli` - command-line interface
3. `dashboard` - web dashboard

### Link CLI Globally (Optional)

To use `solvent` as a global command:

```bash
npm link -w packages/cli
```

After linking, you can run `solvent` from anywhere. Without linking, use:
- `npx solvent <command>` from the repo root, or
- `node packages/cli/dist/index.js <command>`

## Quick Start

### 1. Scan a Fee Payer

```bash
solvent scan <FEE_PAYER_ADDRESS> --network devnet
```

Replace `<FEE_PAYER_ADDRESS>` with your Kora fee payer's address.

### 2. View the Results

The scan output shows:
- **Total Accounts**: Number of sponsored accounts found
- **Total Rent Locked**: SOL locked in rent
- **Reclaimable Rent**: SOL that can be auto-reclaimed
- **Closeable Accounts**: Accounts with zero balance

### 3. List Accounts with Details

```bash
solvent list <FEE_PAYER_ADDRESS> --network devnet
```

### 4. Watch for Changes

```bash
solvent watch <FEE_PAYER_ADDRESS> --interval 60
```

This polls every 60 seconds and alerts when new closeable accounts appear.

### 5. Reclaim Rent (Dry Run First)

```bash
# Preview what would be reclaimed
solvent reclaim <FEE_PAYER_ADDRESS> --dry-run

# Actually reclaim (requires keypair)
solvent reclaim <FEE_PAYER_ADDRESS> --keypair ~/.config/solana/id.json
```

## Running the Dashboard

```bash
cd packages/dashboard
npm run dev
```

Open http://localhost:5173 in your browser.

## Running the Telegram Bot Locally

```bash
cd packages/telegram
cp .env.example .env.local
# Edit .env.local with your bot token and Redis credentials
npx tsx src/local.ts
```

## Next Steps

- [CLI Reference](./cli-reference.md) - Full command documentation
- [Telegram Bot](./telegram-bot.md) - Bot deployment guide
- [Understanding Rent](./understanding-rent.md) - Learn how rent reclaim works
