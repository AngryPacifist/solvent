# @solvent/core

Core library for **Solvent** - a Solana rent monitoring and reclaim tool for Kora fee payers.

## Installation

```bash
npm install @solvent/core
```

## Usage

```typescript
import {
  scanAndParseAccounts,
  classifyAccounts,
  calculateRentStats,
  closeAccount
} from '@solvent/core'

// Scan a fee payer address
const accounts = await scanAndParseAccounts(feePayer, connection)

// Classify accounts (reclaimable vs monitor-only)
const classified = await classifyAccounts(accounts, feePayer, connection)

// Get stats
const stats = calculateRentStats(classified)
console.log(`Reclaimable: ${stats.reclaimable} SOL`)

// Close and reclaim rent
for (const account of classified.filter(a => a.classification === 'RECLAIMABLE')) {
  await closeAccount(account.address, feePayer, keypair, connection)
}
```

## API

### `scanAndParseAccounts(feePayer, connection)`
Scans transaction history for a fee payer and finds all sponsored account creations.

### `classifyAccounts(accounts, feePayer, connection)`
Classifies accounts as RECLAIMABLE, MONITOR_ONLY, or HAS_BALANCE based on close authority and balance.

### `calculateRentStats(accounts)`
Calculates rent statistics for classified accounts.

### `closeAccount(address, feePayer, keypair, connection)`
Closes an account and reclaims rent to the fee payer.

## License

MIT
