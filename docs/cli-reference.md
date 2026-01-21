# CLI Reference

The Solvent CLI provides commands for scanning, listing, reclaiming, exporting, and watching sponsored accounts.

## Global Options

These options work with most commands:

| Option | Description | Default |
|--------|-------------|---------|
| `-n, --network <network>` | Network to use (`devnet` or `mainnet-beta`) | `devnet` |
| `-r, --rpc <url>` | Custom RPC endpoint URL | Public RPC |
| `-l, --limit <number>` | Maximum transactions to scan | `100` |

## Commands

### `solvent scan <address>`

Scan a fee payer address for sponsored accounts and display a summary report.

```bash
solvent scan <FEE_PAYER_ADDRESS> [options]
```

**Options:**
- `-n, --network <network>` - Network (devnet or mainnet-beta)
- `-r, --rpc <url>` - Custom RPC endpoint
- `-l, --limit <number>` - Max transactions to scan

**Example:**
```bash
solvent scan <FEE_PAYER_ADDRESS> --network devnet --limit 200
```

**Output includes:**
- Total accounts sponsored
- Total rent locked (SOL)
- Reclaimable rent (SOL)
- Closeable accounts count
- ROI calculator showing potential savings

---

### `solvent list <address>`

List all sponsored accounts with details in a table format.

```bash
solvent list <FEE_PAYER_ADDRESS> [options]
```

**Options:**
- `-n, --network <network>` - Network
- `-r, --rpc <url>` - Custom RPC endpoint
- `-f, --filter <type>` - Filter by: `all`, `reclaimable`, `closeable`
- `-l, --limit <number>` - Max transactions to scan

**Example:**
```bash
solvent list <FEE_PAYER_ADDRESS> --filter reclaimable
```

---

### `solvent reclaim <address>`

Reclaim rent from closeable accounts (requires keypair).

```bash
solvent reclaim <FEE_PAYER_ADDRESS> [options]
```

**Options:**
- `-n, --network <network>` - Network
- `-r, --rpc <url>` - Custom RPC endpoint
- `-k, --keypair <path>` - Path to keypair file (required for live mode)
- `--dry-run` - Preview actions without executing
- `-y, --yes` - Skip confirmation prompt

**Examples:**
```bash
# Dry run - preview what would be reclaimed
solvent reclaim <FEE_PAYER_ADDRESS> --dry-run

# Actually reclaim rent
solvent reclaim <FEE_PAYER_ADDRESS> --keypair ~/.config/solana/id.json

# Skip confirmation (use with caution)
solvent reclaim <FEE_PAYER_ADDRESS> --keypair ~/.config/solana/id.json --yes
```

**Safety Features:**
- Dry run mode previews actions
- Confirmation prompt before execution
- Only closes accounts with zero balance
- Verifies close_authority before attempting

---

### `solvent export <address>`

Export account data to JSON or CSV file.

```bash
solvent export <FEE_PAYER_ADDRESS> [options]
```

**Options:**
- `-n, --network <network>` - Network
- `-r, --rpc <url>` - Custom RPC endpoint
- `-f, --format <format>` - Output format: `json` or `csv`
- `-o, --output <path>` - Output file path (without extension)
- `-l, --limit <number>` - Max transactions to scan

**Examples:**
```bash
# Export to JSON
solvent export <FEE_PAYER_ADDRESS> --format json --output my-report

# Export to CSV
solvent export <FEE_PAYER_ADDRESS> --format csv --output accounts
```

Output file is named with timestamp: `my-report-2026-01-21T12-00-00.json`

---

### `solvent watch <address>`

Watch for new closeable accounts with periodic polling.

```bash
solvent watch <FEE_PAYER_ADDRESS> [options]
```

**Options:**
- `-n, --network <network>` - Network
- `-r, --rpc <url>` - Custom RPC endpoint
- `-i, --interval <seconds>` - Polling interval in seconds
- `-l, --limit <number>` - Max transactions to scan

**Example:**
```bash
# Poll every 60 seconds
solvent watch <FEE_PAYER_ADDRESS> --interval 60

# Poll every 5 minutes
solvent watch <FEE_PAYER_ADDRESS> --interval 300
```

Press `Ctrl+C` to stop watching.

**Alerts shown:**
- New closeable accounts detected
- Accounts that were closed since last scan

---

### `solvent config`

Manage persistent CLI configuration. Settings are saved to `~/.solvent/config.json`.

#### `solvent config show`

Display current configuration.

```bash
solvent config show
```

#### `solvent config set-rpc <url>`

Set a custom RPC URL (used by all commands).

```bash
solvent config set-rpc https://my-rpc-provider.com
```

#### `solvent config set-network <network>`

Set the default network.

```bash
solvent config set-network mainnet-beta
```

#### `solvent config clear <key>`

Clear a configuration value.

```bash
# Clear RPC URL
solvent config clear rpc

# Clear network setting
solvent config clear network

# Clear all settings
solvent config clear all
```

---

## Configuration Precedence

Settings are applied in this order (later overrides earlier):

1. **Defaults** - devnet network, public RPC
2. **Config file** - `~/.solvent/config.json`
3. **CLI flags** - `-n`, `-r`, etc.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (invalid address, scan failed, etc.) |

---

## Examples

### Scan on mainnet with custom RPC

```bash
solvent scan <FEE_PAYER_ADDRESS> --network mainnet-beta --rpc https://my-helius-rpc.com
```

### Export reclaimable accounts to CSV

```bash
solvent list <FEE_PAYER_ADDRESS> --filter reclaimable
solvent export <FEE_PAYER_ADDRESS> --format csv --output reclaimable-accounts
```

### Set up persistent config for mainnet operation

```bash
solvent config set-network mainnet-beta
solvent config set-rpc https://my-production-rpc.com
solvent scan <FEE_PAYER_ADDRESS>  # Now uses mainnet by default
```
