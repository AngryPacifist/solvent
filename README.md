# 🧪 Solvent

> **Rent monitoring and reclaim tool for Kora operators on Solana**

[![Built for Kora](https://img.shields.io/badge/Built%20for-Kora-00d4aa?style=for-the-badge)](https://kora.network)
[![Solana](https://img.shields.io/badge/Solana-Devnet%20%7C%20Mainnet-9945FF?style=for-the-badge)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge)](https://typescriptlang.org)

---

## 🎯 What is Solvent?

**Solvent** helps Kora operators monitor and reclaim rent from sponsored accounts on Solana.

When Kora sponsors transactions that create accounts (like ATAs), rent SOL gets locked in those accounts. Solvent:
- **Scans** your fee payer's transaction history
- **Identifies** accounts created by your sponsorship
- **Classifies** accounts as RECLAIMABLE or MONITOR-ONLY
- **Reclaims** rent from closeable accounts (when you have authority)
- **Alerts** you about accounts requiring manual action

---

## ✨ Features

| Feature | CLI | Dashboard |
|---------|-----|-----------|
| Scan fee payer history | ✅ | ✅ |
| List sponsored accounts | ✅ | ✅ |
| Calculate rent statistics | ✅ | ✅ |
| Classify accounts | ✅ | ✅ |
| Filter by status | ✅ | ✅ |
| Auto-reclaim rent | ✅ | 🔜 |
| Dry-run mode | ✅ | — |
| Export reports | ✅ | — |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Clone and install
git clone https://github.com/yourusername/solvent.git
cd solvent
npm install

# Build
npm run build
```

### CLI Usage

```bash
# Scan a fee payer address
node packages/cli/dist/index.js scan <FEE_PAYER_ADDRESS> --network devnet

# List all sponsored accounts
node packages/cli/dist/index.js list <FEE_PAYER_ADDRESS> --network devnet

# List only reclaimable accounts
node packages/cli/dist/index.js list <FEE_PAYER_ADDRESS> --filter reclaimable

# Reclaim rent (dry run)
node packages/cli/dist/index.js reclaim <FEE_PAYER_ADDRESS> --dry-run

# Reclaim rent (live)
node packages/cli/dist/index.js reclaim <FEE_PAYER_ADDRESS> --keypair ~/.config/solana/id.json
```

### Dashboard

```bash
# Start the dashboard
cd packages/dashboard
npm run dev

# Open http://localhost:5173
```

---

## 📊 How It Works

### Account Classification

Solvent classifies sponsored accounts into two categories:

| Classification | Close Authority | Can Auto-Reclaim? |
|----------------|-----------------|-------------------|
| **RECLAIMABLE** | = Fee Payer | ✅ Yes |
| **MONITOR-ONLY** | = User/Other | ❌ No (alert only) |

### Rent Reclaim Flow

```
1. SCAN → Get fee payer's transaction history
2. PARSE → Extract account creation events
3. CLASSIFY → Check close_authority on each account
4. ANALYZE → Calculate rent stats, find closeable (balance=0)
5. ACTION → Auto-close RECLAIMABLE or alert for MONITOR-ONLY
```

---

## 🏗️ Architecture

```
solvent/
├── packages/
│   ├── core/           # Shared library
│   │   ├── types.ts    # Type definitions
│   │   ├── config.ts   # Network config
│   │   ├── scanner.ts  # Transaction scanning
│   │   ├── classifier.ts # Account classification
│   │   ├── analyzer.ts # Rent calculations
│   │   └── reclaimer.ts # Close transactions
│   │
│   ├── cli/            # Command-line interface
│   │   └── commands/
│   │       ├── scan.ts
│   │       ├── list.ts
│   │       └── reclaim.ts
│   │
│   └── dashboard/      # Web interface
│       └── src/
│           └── App.tsx
│
└── package.json        # Monorepo root
```

---

## 🔬 Technical Deep Dive

### The Rent Problem

When Kora sponsors a transaction that creates an ATA:
- Kora's fee payer pays ~0.002 SOL for rent
- The ATA owner is the user (not Kora)
- The `close_authority` defaults to the owner

**Result**: Kora cannot close user-owned accounts → rent is "lost"

### The Solution

Solvent discovered that if `close_authority` is set to the fee payer during account creation, Kora CAN reclaim rent!

```typescript
// Standard ATA creation - Kora CANNOT reclaim
createAssociatedTokenAccountInstruction(feePayer, ata, user, mint);

// With close_authority set - Kora CAN reclaim
createAssociatedTokenAccountInstruction(feePayer, ata, user, mint);
setAuthorityInstruction(ata, user, AuthorityType.CloseAccount, feePayer);
```

We verified this approach successfully reclaims 0.002 SOL per ATA!

---

## 📈 Example Output

### CLI Scan
```
🧪 SOLVENT - Rent Scanner

Fee Payer: 8F9ijbjy1LLLTnEtx9jv7D4i5J2oFSERivE1bZkLiL2v
Network: devnet

Classification complete:
  Total: 6
  Reclaimable: 1
  Closeable (balance=0): 4

╔══════════════════════════════════════════════════════════════╗
║                    SOLVENT RENT REPORT                       ║
╠══════════════════════════════════════════════════════════════╣
║  📊 Total Accounts:                    6                     ║
║  💰 Total Rent Locked:          0.012234 SOL                 ║
║  ✅ Reclaimable:                0.002039 SOL                 ║
╚══════════════════════════════════════════════════════════════╝
```

### Dashboard
- Modern dark theme with teal accents
- Stats cards for quick overview
- Filterable accounts table
- Status badges (Closeable, Active, Reclaimable)

---

## 🛡️ Safety Features

- **Dry Run Mode**: Preview actions without executing
- **Confirmation Prompts**: Require explicit confirmation for reclaim
- **Balance Checks**: Never close accounts with non-zero balance
- **Authority Checks**: Verify close_authority before attempting
- **Full Audit Trail**: Log all actions with tx signatures

---

## 🔧 Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run CLI in dev mode
npm run cli -- scan <ADDRESS>

# Run dashboard
npm run dashboard
```

---

## 📚 Resources

- [Kora Documentation](https://kora.network/docs)
- [Solana Token Program](https://spl.solana.com/token)
- [Builder's Log](./resources/BUILDERS_LOG.md) - Full development journey

---

## 👤 Author

**Outis** - Built for the Superteam Nigeria Kora Bounty

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details
