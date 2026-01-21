# Core Library API

The `@angrypacifist/solvent-core` package provides the core functionality for scanning, classifying, and reclaiming rent from sponsored accounts.

## Installation

```bash
npm install @angrypacifist/solvent-core
```

## Quick Example

```typescript
import {
  scanAndParseAccounts,
  classifyAccounts,
  calculateRentStats,
  reclaimRent
} from '@angrypacifist/solvent-core'

// Scan a fee payer
const creations = await scanAndParseAccounts(feePayerAddress, 'devnet')

// Classify accounts
const accounts = await classifyAccounts(creations, feePayerAddress, 'devnet')

// Get statistics
const stats = calculateRentStats(accounts)
console.log(`Reclaimable: ${stats.reclaimable} SOL`)
```

## API Reference

### Scanning

#### `scanAndParseAccounts(address, network, options?)`

Scans transaction history and extracts account creations.

**Parameters:**
- `address: string` - Fee payer address
- `network: 'devnet' | 'mainnet-beta'` - Network
- `options?: ScanOptions` - Optional settings

**Returns:** `Promise<ParsedAccountCreation[]>`

```typescript
interface ScanOptions {
  limit?: number        // Max transactions (default: 1000)
  rpcUrl?: string       // Custom RPC URL
}

interface ParsedAccountCreation {
  account: string
  payer: string
  owner: string
  mint: string | null
  type: 'CreateAccount' | 'CreateAssociatedTokenAccount' | 'InitializeAccount'
  signature: string
  blockTime: number | null
  lamports: number
}
```

---

### Classification

#### `classifyAccounts(creations, feePayerAddress, network, rpcUrl?)`

Classifies accounts as RECLAIMABLE or MONITOR_ONLY.

**Parameters:**
- `creations: ParsedAccountCreation[]` - From scanning
- `feePayerAddress: string` - Fee payer address
- `network: 'devnet' | 'mainnet-beta'` - Network
- `rpcUrl?: string` - Custom RPC URL

**Returns:** `Promise<SponsoredAccount[]>`

```typescript
interface SponsoredAccount {
  address: string
  type: 'ATA' | 'SYSTEM' | 'PDA' | 'UNKNOWN'
  owner: string
  closeAuthority: string | null
  mint: string | null
  rentLamports: number
  tokenBalance: number
  classification: 'RECLAIMABLE' | 'MONITOR_ONLY'
  status: 'ACTIVE' | 'CLOSEABLE' | 'CLOSED'
  creationSignature: string
  createdAt: Date
}
```

**Classification Logic:**
- `RECLAIMABLE`: close_authority equals fee payer, OR owner equals fee payer
- `MONITOR_ONLY`: close_authority is someone else

**Status Logic:**
- `CLOSEABLE`: tokenBalance === 0
- `ACTIVE`: tokenBalance > 0
- `CLOSED`: account no longer exists

---

### Analysis

#### `calculateRentStats(accounts)`

Calculates rent statistics from classified accounts.

**Parameters:**
- `accounts: SponsoredAccount[]` - Classified accounts

**Returns:** `RentStats`

```typescript
interface RentStats {
  totalLocked: number     // Total rent in SOL
  reclaimable: number     // Reclaimable rent in SOL
  monitorOnly: number     // Monitor-only rent in SOL
  totalAccounts: number   // Active account count
  closeableAccounts: number
  reclaimableAccounts: number
}
```

#### `getReclaimableAccounts(accounts)`

Filters to only reclaimable + closeable accounts.

```typescript
const ready = getReclaimableAccounts(accounts)
// Returns accounts where classification === 'RECLAIMABLE' && status === 'CLOSEABLE'
```

#### `getAlertableAccounts(accounts)`

Gets monitor-only accounts that are closeable (for alerting users).

```typescript
const alerts = getAlertableAccounts(accounts)
// Returns accounts where classification === 'MONITOR_ONLY' && status === 'CLOSEABLE'
```

---

### Reclaiming

#### `closeAccount(account, keypair, network, destination?)`

Closes a single account and reclaims rent.

**Parameters:**
- `account: SponsoredAccount` - Account to close
- `keypair: Keypair` - Signing keypair (must have close authority)
- `network: 'devnet' | 'mainnet-beta'` - Network
- `destination?: string` - Rent destination (defaults to keypair)

**Returns:** `Promise<ReclaimResult>`

```typescript
interface ReclaimResult {
  account: string
  success: boolean
  rentReclaimed: number    // SOL
  signature: string | null
  error: string | null
  timestamp: Date
}
```

#### `reclaimRent(accounts, keypair, network, options?)`

Batch reclaim rent from multiple accounts.

**Parameters:**
- `accounts: SponsoredAccount[]` - Accounts to process
- `keypair: Keypair` - Signing keypair
- `network: 'devnet' | 'mainnet-beta'` - Network
- `options?: ReclaimOptions` - Settings

```typescript
interface ReclaimOptions {
  dryRun?: boolean      // Preview without executing
  batchSize?: number    // Max accounts per batch (default: 10)
  destination?: string  // Rent destination
}
```

---

### Utilities

#### `lamportsToSol(lamports)`

Convert lamports to SOL.

```typescript
const sol = lamportsToSol(2039280) // 0.00203928
```

#### `solToLamports(sol)`

Convert SOL to lamports.

```typescript
const lamports = solToLamports(0.002) // 2000000
```

#### `formatSol(lamports, decimals?)`

Format lamports as a SOL string.

```typescript
formatSol(2039280) // "0.002039 SOL"
formatSol(2039280, 4) // "0.0020 SOL"
```

#### `getConnection(network, customRpcUrl?)`

Get a Solana Connection instance.

```typescript
const connection = getConnection('devnet')
const customConn = getConnection('mainnet-beta', 'https://my-rpc.com')
```

---

## Types

All types are exported from the package:

```typescript
import type {
  Network,
  SponsoredAccount,
  RentStats,
  ReclaimResult,
  ScanOptions,
  ReclaimOptions,
  AccountClassification,
  AccountStatus,
  AccountType
} from '@angrypacifist/solvent-core'
```

---

## Complete Example

```typescript
import { Keypair } from '@solana/web3.js'
import * as fs from 'fs'
import {
  scanAndParseAccounts,
  classifyAccounts,
  calculateRentStats,
  getReclaimableAccounts,
  reclaimRent
} from '@angrypacifist/solvent-core'

async function main() {
  const feePayerAddress = 'YOUR_FEE_PAYER_ADDRESS'
  const network = 'devnet'
  
  // 1. Scan
  console.log('Scanning...')
  const creations = await scanAndParseAccounts(feePayerAddress, network, {
    limit: 200
  })
  
  // 2. Classify
  console.log('Classifying...')
  const accounts = await classifyAccounts(creations, feePayerAddress, network)
  
  // 3. Analyze
  const stats = calculateRentStats(accounts)
  console.log(`Total accounts: ${stats.totalAccounts}`)
  console.log(`Reclaimable: ${stats.reclaimable} SOL`)
  
  // 4. Get reclaimable accounts
  const reclaimable = getReclaimableAccounts(accounts)
  console.log(`Ready to reclaim: ${reclaimable.length} accounts`)
  
  // 5. Reclaim (optional)
  if (reclaimable.length > 0) {
    const keypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync('./keypair.json', 'utf-8')))
    )
    
    const results = await reclaimRent(reclaimable, keypair, network, {
      dryRun: true  // Set to false to actually reclaim
    })
    
    const success = results.filter(r => r.success)
    console.log(`Reclaimed: ${success.length} accounts`)
  }
}

main().catch(console.error)
```
