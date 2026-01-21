# Dashboard

The Solvent Dashboard is a web-based interface for monitoring sponsored accounts.

## Features

- **Multi-wallet Support** - Scan and compare multiple fee payers
- **Rent Chart** - Visualize rent locked over time
- **Account Filtering** - Filter by all, reclaimable, or closeable
- **Export** - Download data as JSON or CSV
- **Custom RPC** - Use your own endpoint for mainnet
- **Responsive Design** - Works on desktop and mobile

## Running Locally

```bash
cd packages/dashboard
npm run dev
```

Open http://localhost:5173

## Deploying to Vercel

```bash
cd packages/dashboard
npx vercel --prod
```

The `vercel.json` is configured to build the core library first.

## Usage

### Scanning an Address

1. Enter a fee payer address in the search box
2. Select network (Devnet or Mainnet)
3. Click **Scan**

### Using Custom RPC (Mainnet)

When using mainnet, the public RPC has rate limits. Enter a custom RPC URL:

1. Select **Mainnet** from the network dropdown
2. Enter your RPC URL in the field that appears
3. The URL is saved to localStorage

Recommended RPC providers:
- [Helius](https://helius.dev) (free tier available)
- [QuickNode](https://quicknode.com)
- [Triton](https://triton.one)

### Multi-wallet Comparison

1. Scan the first address
2. Enter a second address and scan again
3. Click wallet tabs to switch between them
4. Click ✕ to remove a wallet from view

### Filtering Accounts

Use the filter tabs above the table:
- **All** - Show all sponsored accounts
- **Reclaimable** - Accounts where you have close authority
- **Closeable** - Accounts with zero balance

### Exporting Data

Click **JSON** or **CSV** buttons to download:
- All visible accounts based on current filter
- Includes full address, type, owner, rent, status
- Timestamp in filename

## Architecture

```
packages/dashboard/
├── src/
│   ├── main.tsx          # React entry point
│   ├── App.tsx           # Main application (550 lines)
│   ├── App.css           # Component styles
│   └── index.css         # Design system (827 lines)
├── vite.config.ts        # Vite with Buffer polyfill
├── vercel.json           # Deployment config
└── package.json
```

## Technology Stack

- **React 19** - UI framework
- **Vite** - Build tool
- **Recharts** - Charts
- **@solvent/core** - Scanning and classification
- **@solana/web3.js** - Solana interaction

## Design System

The dashboard uses CSS custom properties for theming:

```css
:root {
  --primary: #00d4aa;
  --background: #0a0a0f;
  --card-bg: #12121a;
  --text-primary: #ffffff;
  --text-secondary: #a0a0b0;
}
```

## Customizing

### Changing Colors

Edit `src/index.css` and modify the `:root` variables.

### Adding Stats Cards

In `App.tsx`, add to the stats grid:

```tsx
<div className="stat-card">
  <div className="stat-label">My Stat</div>
  <div className="stat-value">{myValue}</div>
</div>
```

### Adding Table Columns

In the accounts table section of `App.tsx`, add `<th>` and `<td>` elements.
