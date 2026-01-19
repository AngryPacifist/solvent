import { useState, useCallback } from 'react'
import './App.css'

// SVG Icons
const Icons = {
  chart: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>,
  coin: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v12M8 10h8M8 14h8" /></svg>,
  recycle: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" /><path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" /><path d="m14 16-3 3 3 3" /><path d="M8.293 13.596 4.875 7.97l-1.586 2.743" /><path d="m3 11 4-4-4-4" /><path d="m12 5 3.293-.054 1.582 2.744" /><path d="M16 3l4 4-4 4" /></svg>,
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  check: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>,
  lock: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
  eye: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  testTube: <svg width="24" height="24" viewBox="0 0 32 32" fill="none"><path d="M11 4h10v3h-2v7.5l6.5 11.5a3 3 0 01-2.6 4.5H9.1a3 3 0 01-2.6-4.5L13 14.5V7h-2V4z" fill="currentColor" /></svg>
}

// Types
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

interface RentStats {
  totalLocked: number
  reclaimable: number
  monitorOnly: number
  totalAccounts: number
  closeableAccounts: number
  reclaimableAccounts: number
}

type Network = 'devnet' | 'mainnet-beta'
type FilterType = 'all' | 'reclaimable' | 'closeable'

// Helpers
function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function App() {
  const [address, setAddress] = useState('')
  const [network, setNetwork] = useState<Network>('devnet')
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<SponsoredAccount[]>([])
  const [stats, setStats] = useState<RentStats | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [error, setError] = useState<string | null>(null)

  // Scan function - calls Solana RPC directly
  const handleScan = useCallback(async () => {
    if (!address) return

    setLoading(true)
    setError(null)

    try {
      // Import Solana web3
      const { Connection, PublicKey } = await import('@solana/web3.js')
      const { getAccount } = await import('@solana/spl-token')

      const rpcUrl = network === 'devnet'
        ? 'https://api.devnet.solana.com'
        : 'https://api.mainnet-beta.solana.com'

      const connection = new Connection(rpcUrl, 'confirmed')
      const feePayer = new PublicKey(address)

      // Get transaction signatures
      const signatures = await connection.getSignaturesForAddress(feePayer, { limit: 50 })

      // Parse transactions for account creations
      const foundAccounts: SponsoredAccount[] = []

      for (const sig of signatures.slice(0, 20)) {
        try {
          const tx = await connection.getParsedTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          })

          if (!tx?.meta) continue

          // Check instructions for account creations
          for (const ix of tx.transaction.message.instructions) {
            if ('parsed' in ix && ix.parsed) {
              // Check for ATA creation
              if (ix.program === 'spl-associated-token-account' && ix.parsed.type === 'create') {
                const acct: SponsoredAccount = {
                  address: ix.parsed.info.account,
                  type: 'ATA',
                  owner: ix.parsed.info.wallet,
                  closeAuthority: null,
                  mint: ix.parsed.info.mint,
                  rentLamports: 2039280, // Approximate ATA rent
                  tokenBalance: 0,
                  classification: 'MONITOR_ONLY',
                  status: 'ACTIVE',
                  creationSignature: sig.signature,
                  createdAt: new Date((sig.blockTime || 0) * 1000)
                }

                // Check if account still exists and get close authority
                try {
                  const tokenAccount = await getAccount(
                    connection,
                    new PublicKey(acct.address)
                  )
                  acct.tokenBalance = Number(tokenAccount.amount)
                  acct.closeAuthority = tokenAccount.closeAuthority?.toBase58() || tokenAccount.owner.toBase58()
                  acct.status = acct.tokenBalance === 0 ? 'CLOSEABLE' : 'ACTIVE'

                  // Check if reclaimable
                  if (acct.closeAuthority?.toLowerCase() === address.toLowerCase()) {
                    acct.classification = 'RECLAIMABLE'
                  }
                } catch {
                  acct.status = 'CLOSED'
                }

                // Avoid duplicates
                if (!foundAccounts.some(a => a.address === acct.address)) {
                  foundAccounts.push(acct)
                }
              }
            }
          }
        } catch (e) {
          console.error('Error parsing tx:', e)
        }
      }

      setAccounts(foundAccounts)

      // Calculate stats
      const activeAccounts = foundAccounts.filter(a => a.status !== 'CLOSED')
      const totalLocked = activeAccounts.reduce((sum, a) => sum + a.rentLamports, 0)
      const reclaimableAccts = activeAccounts.filter(a => a.classification === 'RECLAIMABLE' && a.status === 'CLOSEABLE')
      const reclaimable = reclaimableAccts.reduce((sum, a) => sum + a.rentLamports, 0)

      setStats({
        totalLocked: lamportsToSol(totalLocked),
        reclaimable: lamportsToSol(reclaimable),
        monitorOnly: lamportsToSol(totalLocked - reclaimable),
        totalAccounts: activeAccounts.length,
        closeableAccounts: activeAccounts.filter(a => a.status === 'CLOSEABLE').length,
        reclaimableAccounts: reclaimableAccts.length
      })

    } catch (e: any) {
      setError(e.message || 'Failed to scan')
    } finally {
      setLoading(false)
    }
  }, [address, network])

  // Filter accounts
  const filteredAccounts = accounts.filter(a => {
    if (filter === 'reclaimable') return a.classification === 'RECLAIMABLE'
    if (filter === 'closeable') return a.status === 'CLOSEABLE'
    return true
  })

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1><span className="header-icon">{Icons.testTube}</span> Solvent</h1>
        <p>Rent monitoring and reclaim for Kora operators</p>
      </header>

      {/* Search */}
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Enter Kora fee payer address..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleScan()}
        />
        <select
          className="network-select"
          value={network}
          onChange={(e) => setNetwork(e.target.value as Network)}
        >
          <option value="devnet">Devnet</option>
          <option value="mainnet-beta">Mainnet</option>
        </select>
        <button
          className="scan-button"
          onClick={handleScan}
          disabled={loading || !address}
        >
          {loading ? 'Scanning...' : 'Scan'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label"><span className="icon">{Icons.chart}</span> Total Accounts</div>
            <div className="stat-value">{stats.totalAccounts}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><span className="icon">{Icons.coin}</span> Total Rent Locked</div>
            <div className="stat-value">
              {stats.totalLocked.toFixed(4)} <span className="stat-unit">SOL</span>
            </div>
          </div>
          <div className="stat-card highlight">
            <div className="stat-label"><span className="icon">{Icons.recycle}</span> Reclaimable</div>
            <div className="stat-value primary">
              {stats.reclaimable.toFixed(4)} <span className="stat-unit">SOL</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label"><span className="icon">{Icons.clock}</span> Closeable</div>
            <div className="stat-value">{stats.closeableAccounts}</div>
          </div>
        </div>
      )}

      {/* Accounts Table */}
      {accounts.length > 0 && (
        <div className="accounts-section">
          <div className="accounts-header">
            <h2>Sponsored Accounts</h2>
            <div className="filter-tabs">
              <button
                className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({accounts.length})
              </button>
              <button
                className={`filter-tab ${filter === 'reclaimable' ? 'active' : ''}`}
                onClick={() => setFilter('reclaimable')}
              >
                Reclaimable ({accounts.filter(a => a.classification === 'RECLAIMABLE').length})
              </button>
              <button
                className={`filter-tab ${filter === 'closeable' ? 'active' : ''}`}
                onClick={() => setFilter('closeable')}
              >
                Closeable ({accounts.filter(a => a.status === 'CLOSEABLE').length})
              </button>
            </div>
          </div>

          <table className="accounts-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>Type</th>
                <th>Rent</th>
                <th>Status</th>
                <th>Reclaim?</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => (
                <tr key={account.address}>
                  <td className="address-cell">{formatAddress(account.address)}</td>
                  <td>{account.type}</td>
                  <td>{lamportsToSol(account.rentLamports).toFixed(4)} SOL</td>
                  <td>
                    <span className={`badge ${account.status === 'CLOSEABLE' ? 'closeable' : 'active'}`}>
                      <span className="badge-icon">{account.status === 'CLOSEABLE' ? Icons.check : Icons.lock}</span>
                      {account.status === 'CLOSEABLE' ? 'Closeable' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${account.classification === 'RECLAIMABLE' ? 'reclaimable' : 'monitor'}`}>
                      <span className="badge-icon">{account.classification === 'RECLAIMABLE' ? Icons.recycle : Icons.eye}</span>
                      {account.classification === 'RECLAIMABLE' ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          Scanning transaction history...
        </div>
      )}

      {/* Empty State */}
      {!loading && accounts.length === 0 && stats === null && (
        <div className="empty-state">
          <h3>Enter a fee payer address to start</h3>
          <p>Solvent will scan for sponsored accounts and show rent statistics.</p>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        Built for the <a href="https://superteam.fun" target="_blank" rel="noopener noreferrer">Superteam Nigeria Kora Bounty</a> | By Outis
      </footer>
    </div>
  )
}

export default App
