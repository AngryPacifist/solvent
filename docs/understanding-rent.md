# Understanding Rent on Solana

This document explains how rent works on Solana and how Solvent helps Kora operators reclaim it.

## What is Rent?

On Solana, every account must maintain a minimum SOL balance to exist on-chain. This is called **rent-exemption**.

### Rent Amounts

| Account Type | Size (bytes) | Rent Required |
|--------------|--------------|---------------|
| Token Account (ATA) | 165 | ~0.00203 SOL |
| Mint Account | 82 | ~0.00145 SOL |
| System Account | varies | varies |

The formula is approximately **0.00000696 SOL per byte**.

### Why Rent Exists

Rent prevents spam by requiring a cost to store data on-chain. Without it, attackers could fill the network with empty accounts for free.

## The Kora Rent Problem

When Kora sponsors a transaction that creates an account:

1. **Kora's fee payer** pays the transaction fee
2. **Kora's fee payer** also pays the rent for any new accounts
3. The **account owner** is typically the user, not Kora
4. The rent SOL is now "locked" in that account

### Example: Sponsored ATA Creation

```
User wants to receive USDC → needs an ATA
Kora sponsors the transaction
├── Creates ATA for user
├── Fee payer: Kora
├── Owner: User
├── Rent paid: 0.00203 SOL (from Kora)
└── close_authority: User (by default)
```

Result: Kora paid 0.00203 SOL that it cannot reclaim.

### Scale of the Problem

| Sponsorships | Rent Lost |
|--------------|-----------|
| 1,000 | ~2 SOL |
| 10,000 | ~20 SOL |
| 100,000 | ~200 SOL |

For high-volume operators, this adds up quickly.

## How Accounts Can Be Closed

An account can be closed when:
1. Its **token balance is zero**
2. The **close_authority** executes a close instruction

### Who is the close_authority?

| Scenario | close_authority | Kora can close? |
|----------|-----------------|-----------------|
| Default ATA creation | Account owner | ❌ No |
| ATA with close_authority set | Whoever was set | ✅ If set to fee payer |

### The Solution: Set close_authority

If `close_authority` is set to the fee payer during account creation:

```typescript
// Standard - Kora CANNOT reclaim
createAssociatedTokenAccountInstruction(feePayer, ata, user, mint)

// With close_authority - Kora CAN reclaim
createAssociatedTokenAccountInstruction(feePayer, ata, user, mint)
setAuthorityInstruction(ata, user, AuthorityType.CloseAccount, feePayer)
```

## How Solvent Helps

### Classification

Solvent scans accounts and classifies them:

| Classification | Meaning | Action |
|----------------|---------|--------|
| **RECLAIMABLE** | close_authority = fee payer | Auto-close when empty |
| **MONITOR_ONLY** | close_authority = user | Alert user to close manually |

### Account Status

| Status | Meaning |
|--------|---------|
| **CLOSEABLE** | Balance = 0, can be closed now |
| **ACTIVE** | Balance > 0, cannot close yet |
| **CLOSED** | Already closed |

### Workflow

```
1. SCAN     → Find all accounts paid for by fee payer
2. CLASSIFY → Check close_authority on each
3. ANALYZE  → Calculate total rent, reclaimable amount
4. ALERT    → Notify about MONITOR_ONLY + CLOSEABLE accounts
5. RECLAIM  → Auto-close RECLAIMABLE + CLOSEABLE accounts
```

## Reclaiming Process

When an account is closed:

1. The account's rent (0.00203 SOL) is transferred to a destination
2. The account is removed from the chain
3. The space is freed

### Safety Checks

Solvent verifies before closing:
- ✅ Account still exists
- ✅ Token balance is zero
- ✅ close_authority matches fee payer
- ✅ Dry-run option to preview

## Best Practices for Kora Operators

### 1. Set close_authority When Sponsoring

Update your Kora configuration to set close_authority on ATAs:

```typescript
// After creating ATA, set close authority
setAuthorityInstruction(
  ata,
  user,  // current authority (owner)
  AuthorityType.CloseAccount,
  feePayer  // new close authority
)
```

### 2. Monitor Regularly

Use Solvent to:
- Run `solvent watch` for real-time monitoring
- Set up Telegram bot alerts
- Review dashboard periodically

### 3. Reclaim Promptly

When accounts become closeable:
- Use `solvent reclaim --dry-run` to preview
- Execute reclaim when satisfied
- Keep audit trail of reclaimed amounts

### 4. Track ROI

The CLI shows an ROI calculator:

```
╔════════════════════════════════════════════════════════════════╗
║  💎 ROI CALCULATOR                                             ║
╠════════════════════════════════════════════════════════════════╣
║  If close_authority was set to fee payer during creation:      ║
║  → You could reclaim:   0.034668 SOL (17 accounts)             ║
╚════════════════════════════════════════════════════════════════╝
```

This shows how much you could save by setting close_authority.

## Limitations

### Cannot Close:
- Accounts with non-zero token balance
- Accounts where close_authority is not the fee payer
- Accounts the fee payer doesn't have authority over

### Requires:
- Fee payer's private key for reclaim operations
- RPC access to the network
- Account to still exist (not already closed)

## Summary

| Problem | Solution |
|---------|----------|
| Rent locked in sponsored accounts | Set close_authority to fee payer |
| Don't know which accounts can be closed | Use Solvent to scan and classify |
| Manual process to close | Use CLI reclaim or set up automation |
| Missed opportunities | Set up alerts with Telegram bot |
