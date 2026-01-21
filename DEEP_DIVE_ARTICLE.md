# Building Solvent: A Deep Dive into Rent Recovery for Kora Operators

> *How I built a complete toolkit to help Kora operators track and reclaim rent from sponsored accounts on Solana*

**Author:** Outis  
**Project:** Solvent — Rent Monitoring & Reclaim Bot  
**Bounty:** Superteam Nigeria Beginner Developer Challenge  
**Timeline:** January 18-21, 2026 (4 days)

---

## Table of Contents

1. [The Beginning: Why This Bounty?](#the-beginning-why-this-bounty)
2. [Understanding the Problem: What Even Is Rent?](#understanding-the-problem-what-even-is-rent)
3. [The Research Phase: Reading Before Building](#the-research-phase-reading-before-building)
4. [The Critical Finding: Can Kora Even Reclaim Rent?](#the-critical-finding-can-kora-even-reclaim-rent)
5. [Setting Up the Lab: Kora Node Configuration](#setting-up-the-lab-kora-node-configuration)
6. [The Breakthrough: close_authority Discovery](#the-breakthrough-close_authority-discovery)
7. [Building Solvent: From Core Library to Four Interfaces](#building-solvent-from-core-library-to-four-interfaces)
8. [The Vercel Deployment Saga](#the-vercel-deployment-saga)
9. [Publishing to npm: More Hurdles](#publishing-to-npm-more-hurdles)
10. [End-to-End Verification](#end-to-end-verification)
11. [Final Thoughts & Lessons Learned](#final-thoughts--lessons-learned)

---

## The Beginning: Why This Bounty?

I'll be honest—when I first saw this bounty, I didn't immediately understand the problem. 

"Automated rent-reclaim bot for Kora operators." What does that even mean? Rent? On a blockchain?

But the bounty description had this line that stuck with me:

> *"Over time, many of these accounts become inactive, closed, or no longer needed. In most cases, operators do not actively track or reclaim this rent, leading to **silent capital loss**."*

Silent capital loss. That phrase made me curious. If Kora operators are losing money without even knowing it, and there's no tool to help them—that's a real problem worth solving.

So I decided to dig in. Not just to build something, but to genuinely understand what was happening under the hood.

---

## Understanding the Problem: What Even Is Rent?

Before I could build anything, I needed to understand Solana's rent model. I spent the first few hours reading documentation.

### The Rent-Exemption Model

Every account on Solana must maintain a minimum SOL balance to exist. This isn't a fee you pay periodically—it's a one-time deposit that makes your account "rent-exempt."

The math is roughly: **0.00000696 SOL per byte**.

For a typical Token Account (also called ATA—Associated Token Account), that's about **0.00203 SOL** for 165 bytes of storage.

Doesn't sound like much, right? But here's where it gets interesting.

### When Kora Sponsors a Transaction

Kora is gasless transaction infrastructure. Apps use Kora to sponsor user transactions so users don't need SOL to pay fees.

When Kora sponsors a transaction that creates an account:

1. **Kora's fee payer** deposits the rent (0.00203 SOL)
2. The account's **owner** is set to the user
3. The rent is now "locked" in that account

Here's the problem: **Kora paid for the account, but Kora doesn't own it**.

For a Kora node processing thousands of transactions:
- 1,000 ATAs = ~2 SOL locked
- 10,000 ATAs = ~20 SOL locked
- 100,000 ATAs = ~200 SOL locked

This is real money sitting in accounts that Kora has no direct control over.

---

## The Research Phase: Reading Before Building

I'm a firm believer in understanding before implementing. So before writing a single line of code, I read:

1. **Kora Operator Documentation** — All 200KB of it. Learned about `kora.toml`, `signers.toml`, the RPC gateway, fee payer policies.

2. **Solana Core Concepts** — Accounts, transactions, programs, PDAs. The ~3,000 line documentation file. I needed to understand how data flows.

3. **Solana Token Program** — This was the big one. 18,000+ lines of documentation about token accounts, mints, and crucially: the `CloseAccount` instruction.

4. **Solana RPC API** — Understanding `getSignaturesForAddress`, `getTransaction`, `getAccountInfo`. These would be my tools for scanning the blockchain.

### The Critical Question

After reading everything, I had one question I couldn't answer from the docs:

> "If Kora pays rent for a user's token account, can Kora close that account and get the rent back?"

I found this in the Token Program docs:

> *"The `CloseAccount` instruction permanently closes a token account and transfers all remaining SOL (rent) to a specified destination account. The token account **balance must be zero** before closing. **Only the token account owner or designated close authority** can execute this instruction."*

Only the **owner** or **close authority**. Not the person who paid the rent.

This was concerning. I reached out to the bounty organizers to clarify:

> Me: "Is pure monitoring/alerting acceptable if there is any constraint around claiming the rent?"

> @codewithmide: "Pure monitoring/alerting is acceptable. The goal is to make the node operator **aware** of a rent they can claim if that process cannot be automated."

Okay. So if Kora can't always auto-reclaim, at least monitoring is valuable. But I wasn't satisfied. I kept digging.

---

## Setting Up the Lab: Kora Node Configuration

Before building the bot, I needed real test data. That meant running an actual Kora node.

### The Setup

I installed:
- Rust & Cargo (for Kora CLI)
- Solana CLI 3.0.13
- Kora CLI 2.0.2
- Node.js (for the bot)

Created a devnet wallet with 1 SOL for testing (address: `8F9ijbjy1LLLTnEtx9jv7D4i5J2oFSERivE1bZkLiL2v`).

### Configuration Files

**kora.toml** — The main config:
```toml
[kora]
rate_limit = 100

[validation]
price_source = "Mock"  # Devnet testing
max_allowed_lamports = 100000000  # 0.1 SOL max

allowed_programs = [
    "11111111111111111111111111111111",      # System Program
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",  # SPL Token
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", # Associated Token
]
```

**signers.toml** — Keypair configuration:
```toml
[signer_pool]
strategy = "round_robin"

[[signers]]
name = "devnet_signer"
type = "memory"
private_key_env = "KORA_PRIVATE_KEY"
```

### Starting the Node

```powershell
$env:KORA_PRIVATE_KEY = (Get-Content "path/to/keypair.json" -Raw)
kora --config kora.toml rpc start --signers-config signers.toml
```

Kora was now running at `http://127.0.0.1:8080`. Time to create some test data.

### Generating Sponsored Accounts

I wrote a script (`sponsor-transactions.js`) that:
1. Generates random test wallets
2. Creates ATA creation transactions
3. Sends them through Kora for sponsorship

After running it, I had 3 sponsored ATAs on devnet:

| # | ATA Address | Rent Locked |
|---|-------------|-------------|
| 1 | `Ht4WXqZq...` | ~0.00203 SOL |
| 2 | `Bz91aHTH...` | ~0.00203 SOL |
| 3 | `DqwGYZDZ...` | ~0.00203 SOL |

Total rent locked: ~0.0061 SOL. My test data was ready.

---

## The Breakthrough: close_authority Discovery

This is where things got exciting.

I was reading the Token Program source code more carefully and noticed something: the `CloseAccount` instruction checks for **either** the owner **or** the `close_authority`.

Wait. What if we could set `close_authority` to the Kora fee payer during account creation?

### Testing the Hypothesis

I wrote a test script (`test-close-authority.js`):

```javascript
// 1. Create ATA (Kora pays rent)
const ata = await createAssociatedTokenAccount(...)

// 2. Set close_authority to Kora's fee payer
await setAuthority(
    ata,
    user,  // current authority (owner)
    AuthorityType.CloseAccount,
    feePayer  // new authority = Kora!
)

// 3. Later, when balance is zero...
await closeAccount(ata, destination, feePayer)  // Kora signs!
```

### The Test

```
=== Testing Rent Reclaim via close_authority ===

1. Loading Kora fee payer keypair...
   Fee Payer: 8F9ijbjy1LLLTnEtx9jv7D4i5J2oFSERivE1bZkLiL2v
   Balance: 0.99180288 SOL

2. Creating test user wallet...
3. Creating ATA (Kora pays rent)...
4. Setting close_authority to Kora fee payer...

... [account emptied] ...

8. Kora balance after close: 0.99178788 SOL
   💰 Rent reclaimed: 0.00203428 SOL

🎉 SUCCESS! Rent reclaim via close_authority works!
```

**This was the breakthrough.**

If Kora is set as `close_authority` during ATA creation, Kora CAN close the account and reclaim the rent!

### The Classification System

This discovery led me to design a classification system:

| Classification | Condition | Can Auto-Reclaim? |
|----------------|-----------|-------------------|
| **RECLAIMABLE** | `close_authority` = fee payer | ✅ Yes |
| **MONITOR_ONLY** | `close_authority` = owner or null | ❌ No (alert only) |

The tool couldn't reclaim everything, but it could reclaim properly-configured accounts AND alert operators about the rest.

This was better than "pure monitoring." This was a real solution.

---

---

## Building Solvent: From Core Library to Four Interfaces

With the classification system designed, it was time to build. I named the project **Solvent**—a play on SOL + solvent (dissolves accounts to release SOL).

### The Architecture Decision

I decided to build a monorepo with a shared core library and multiple interfaces:

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                      │
├──────────────────┬──────────────────┬──────────────────────┤
│       CLI        │   Web Dashboard  │    Telegram Bot      │
│    (Primary)     │   (Impressive)   │   (Alerts/Mobile)    │
├──────────────────┴──────────────────┴──────────────────────┤
│                       @solvent/core                         │
│  scanner.ts → classifier.ts → analyzer.ts → reclaimer.ts   │
├─────────────────────────────────────────────────────────────┤
│                      SOLANA RPC                             │
│        Devnet ↔ Mainnet (configurable)                      │
└─────────────────────────────────────────────────────────────┘
```

Why four interfaces?
- **CLI** — Fast to build, practical for real operators
- **Dashboard** — Visually impressive for demos and quick scans
- **Telegram Bot** — Mobile alerts and passive monitoring
- **npm Package** — Let others build their own tools

### Building the Core Library

The `@solvent/core` package became the heart of everything:

**scanner.ts** — Scans a fee payer's transaction history:
```typescript
export async function scanAndParseAccounts(
    address: string,
    network: Network,
    options?: { limit?: number; rpcUrl?: string }
): Promise<ParsedAccountCreation[]>
```

**classifier.ts** — Determines if accounts are reclaimable:
```typescript
export async function classifyAccounts(
    creations: ParsedAccountCreation[],
    feePayerAddress: string,
    network: Network,
    rpcUrl?: string
): Promise<SponsoredAccount[]>
```

**analyzer.ts** — Calculates rent statistics:
```typescript
export function calculateRentStats(accounts: SponsoredAccount[]): RentStats
```

**reclaimer.ts** — Actually closes accounts:
```typescript
export async function reclaimRent(
    accounts: SponsoredAccount[],
    keypair: Keypair,
    network: Network,
    options?: { dryRun?: boolean }
): Promise<ReclaimResult[]>
```

### Building the CLI

I wanted the CLI to be practical. Six commands:

```bash
solvent scan <address>   # Quick summary with rent stats
solvent list <address>   # Detailed table of all accounts
solvent reclaim <address> --dry-run   # Preview what would be reclaimed
solvent reclaim <address> --keypair ~/.config/solana/id.json   # Actually reclaim
solvent export <address> --format csv   # Export for reporting
solvent watch <address> --interval 60   # Live monitoring
```

The CLI test on my devnet fee payer:

```
Classification complete:
  Total: 26
  Reclaimable: 7
  Closeable (balance=0): 24

╔══════════════════════════════════════════════════════════════╗
║                    SOLVENT RENT REPORT                       ║
╠══════════════════════════════════════════════════════════════╣
║  📊 Total Accounts:                   24                     ║
║  💰 Total Rent Locked:          0.048943 SOL                 ║
╠══════════════════════════════════════════════════════════════╣
║  ✅ Reclaimable Accounts:              7                     ║
║  💎 Reclaimable Rent:           0.014275 SOL                 ║
╠══════════════════════════════════════════════════════════════╣
║  👁️  Monitor-Only Rent:          0.034668 SOL                 ║
║  ⏳ Closeable (balance=0):            24                     ║
╚══════════════════════════════════════════════════════════════╝
```

It worked! I could see exactly how much rent was locked and how much was reclaimable.

### Building the Dashboard

The dashboard was about making this visually impressive. React + Vite + a dark theme with teal accents.

Features I implemented:
- Address input with network toggle (devnet/mainnet)
- Stats cards showing key metrics
- Filterable accounts table
- Rent chart showing cumulative rent over time
- Multi-wallet tabs (scan and compare multiple fee payers)
- Export to JSON/CSV
- Animated "bubbling test tube" loading screen (on brand!)

One bug I ran into: the chart was showing 26 accounts, but the stats showed 24. Turns out the chart was including CLOSED accounts while `calculateRentStats` filtered them out. Fixed by adding the same filter to the chart data.

### Building the Telegram Bot

This was the most complex interface. I used grammY (a Telegram bot framework) with Upstash Redis for persistence.

Features:
- **Inline Keyboards** — Buttons instead of just text commands
- **Conversation States** — `/scan` prompts for an address if not provided
- **User Preferences** — Network, custom RPC, alert settings stored in Redis
- **Scheduled Alerts** — Cron job scans tracked addresses and sends notifications

The bot has 10 commands and multiple callback handlers for the inline buttons.

---

## The Vercel Deployment Saga

I thought deployment would be easy. It was not.

### Dashboard Deployment: 10+ Attempts

**Problem:** The dashboard depends on `@solvent/core`, which is a workspace package in the monorepo. Vercel couldn't resolve it.

**Attempt 1:** vercel.json at repo root
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "packages/dashboard/dist"
}
```
Result: ❌ "Cannot find module '@solvent/core'"

**Attempt 2:** Explicit workspace builds
```json
{
  "buildCommand": "npm run build -w @solvent/core && npm run build -w dashboard"
}
```
Result: ❌ "No workspaces found: --workspace=packages/dashboard"

I was mixing up package names with package paths. Rookie mistake.

**Attempts 3-9:** Various combinations. All failed.

**Attempt 10: The Solution**

I realized Vercel's Root Directory was set to `packages/dashboard`, which meant `vercel.json` at the repo root was **never being read**.

I created `packages/dashboard/vercel.json`:
```json
{
    "installCommand": "cd ../.. && npm install",
    "buildCommand": "cd ../.. && npm run build -w @solvent/core && cd packages/dashboard && npm run build",
    "outputDirectory": "dist"
}
```

Navigate up to repo root → install all workspaces → build core first → build dashboard.

**Result:** ✅ Deployed!

### Telegram Bot Deployment: More Challenges

Different challenges:
- **Challenge 1:** Vercel's deployment protection was blocking public API access
- **Challenge 2:** Leftover `.js` files in `/api` causing 404s
- **Challenge 3:** npm run build was failing

The solution: `"buildCommand": ""` in vercel.json. Skip the build step entirely—Vercel auto-compiles TypeScript for serverless functions.

But even after deploying, the bot was missing all the good features. Turns out I had two separate files:
- `local.ts` — 758 lines, full-featured for local testing
- `bot.ts` — 218 lines, basic version for webhooks

I had to port all 500+ lines of features from local.ts to bot.ts. That was a 2-hour session.

---

## Publishing to npm: More Hurdles

To make the Telegram bot work cleanly on Vercel, I decided to publish `@solvent/core` to npm instead of inlining the code.

### Scoped Package Naming

Original plan: `@solvent/core`  
Problem: Requires creating an npm organization  
Solution: `@angrypacifist/solvent-core` (user scope)

### 2FA Requirement

npm requires a "granular access token with bypass 2FA" for scoped packages, even without 2FA enabled on my account. Spent 20 minutes figuring out the right token permissions.

### Monorepo Workspace Conflicts

npm commands in the workspace context kept failing with `ENOWORKSPACES` error.

Solution: Create `~/.npmrc` in my user home directory with the auth token directly. This bypassed the workspace issues.

Finally:
```
+ @angrypacifist/solvent-core@1.0.0
```

Published! Now the Telegram bot could import cleanly.

---

## End-to-End Verification

Before calling it done, I needed to verify everything worked together.

### The Test Pipeline

1. **Start Kora node** — Used my devnet keypair
2. **Create 5 test accounts** — ATAs with `close_authority` set to fee payer
3. **Scan with CLI** — Verify they show as RECLAIMABLE + CLOSEABLE
4. **Trigger cron job** — Manually hit the cron endpoint
5. **Check Telegram** — Did the alert arrive?

### Step 1: Starting Kora

Found an interesting Windows quirk—the keypair was at `C:\Users\Outis\~\.config\solana\kora-keypair.json`. That's a literal `~` folder, not the home directory shortcut!

```powershell
$env:KORA_PRIVATE_KEY = Get-Content "C:\Users\Outis\~\.config\solana\kora-keypair.json" -Raw
kora --config kora.toml rpc start --signers-config signers.toml
```

### Step 2: Creating Test Accounts

Wrote `create-5-closeable.js`:

```javascript
// Creates 5 WSOL ATAs with close_authority = fee payer
// These should be detected as RECLAIMABLE by Solvent
```

Created 10 total across two batches.

### Step 3: CLI Verification

```
solvent scan 8F9ijbjy1LLLTnEtx9jv7D4i5J2oFSERivE1bZkLiL2v --network devnet

Classification complete:
  Total: 29
  Reclaimable: 10
  Closeable (balance=0): 27

⚠ NEW! +3 closeable account(s)!
  +0.0061 SOL now reclaimable.
```

The CLI detected the new accounts.

### Step 4: Triggering the Cron

```powershell
Invoke-WebRequest -Uri "https://solvent-telegram-bot.vercel.app/api/cron" `
  -Headers @{"Authorization"="Bearer solvent_cron_secret_..."}
```

Response:
```json
{"message":"Cron job completed","scanned":2,"alertsSent":1}
```

### Step 5: Telegram Alert Received! 🎉

```
🔔 SOLVENT ALERT

5 new closeable account(s) detected!

📍 Address: 8F9ijb...iL2v
📊 Total Closeable: 36
💰 Total Rent: 0.0734 SOL

Run /scan 8F9ijbjy1LLL... for details
```

**The entire pipeline worked end-to-end.**

---

## Final Thoughts & Lessons Learned

### Technical Lessons

1. **Read documentation thoroughly before building.** I spent Day 1 just reading. It saved me from building the wrong thing.

2. **The close_authority discovery was key.** Without it, this would have been just a monitoring tool. With it, it's a real rent recovery system.

3. **Vercel monorepo deployment is tricky.** Put vercel.json in the subdirectory if that's your Root Directory. Use `cd ../..` to navigate up.

4. **npm publishing has friction.** Especially with scoped packages and monorepos. Plan for token/permission issues.

5. **Test end-to-end early.** I found bugs in the Telegram bot that I wouldn't have caught with unit tests.

### What I Would Do Differently

- **Start with the Telegram webhook version**, not the local polling version. Would have avoided porting 500+ lines of code.
- **Publish to npm earlier** in the process for cleaner dependencies.
- **Add more comments** as I went. Some files ended up with 700+ lines.

### What I'm Proud Of

- **Four working interfaces** from a shared core library
- **The close_authority discovery** — a genuine technical finding
- **End-to-end verification** — not just "it compiles"
- **2000+ line builder's log** documenting everything as I went

### The Real Value

For Kora operators, this tool provides:
1. **Visibility** into how much rent is locked in sponsored accounts
2. **Classification** of which accounts can be auto-reclaimed vs. require user action
3. **Automation** for reclaiming properly-configured accounts
4. **Alerts** when new reclaimable accounts appear

And for future Kora implementations, the recommendation is clear: **always set `close_authority` to the fee payer when creating ATAs**. This enables full rent recovery automation.

---

## Links

- **GitHub Repository:** [github.com/AngryPacifist/solvent](https://github.com/AngryPacifist/solvent)
- **npm Package:** [@angrypacifist/solvent-core](https://www.npmjs.com/package/@angrypacifist/solvent-core)
- **Telegram Bot:** [@solvent_rent_bot](https://t.me/solvent_rent_bot)
- **Documentation:** [/docs](./docs/)

---

*Built for the Superteam Nigeria Kora Bounty by Outis*  
*January 18-21, 2026*
