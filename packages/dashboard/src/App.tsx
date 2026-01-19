import { useState, useCallback, useRef, useEffect } from 'react'
import './App.css'
import {
  scanAndParseAccounts,
  classifyAccounts,
  calculateRentStats,
  lamportsToSol,
  type SponsoredAccount,
  type RentStats
} from '@solvent/core'

// SVG Icons
const Icons = {
  chart: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>,
  coin: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v12M8 10h8M8 14h8" /></svg>,
  recycle: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" /><path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" /><path d="m14 16-3 3 3 3" /><path d="M8.293 13.596 4.875 7.97l-1.586 2.743" /><path d="m3 11 4-4-4-4" /><path d="m12 5 3.293-.054 1.582 2.744" /><path d="M16 3l4 4-4 4" /></svg>,
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  check: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>,
  lock: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
  eye: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  chevronDown: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>,
  testTube: <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M14.5 2l6 6-8.5 8.5c-1.5 1.5-4 1.5-5.5 0s-1.5-4 0-5.5L14.5 2z" fill="currentColor" /><path d="M14.5 2L9 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
}

// Custom Dropdown Component
function NetworkDropdown({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const options = [
    { value: 'devnet', label: 'Devnet' },
    { value: 'mainnet-beta', label: 'Mainnet' }
  ]

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(o => o.value === value)

  return (
    <div className="custom-dropdown" ref={dropdownRef}>
      <button
        className="dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span>{selectedOption?.label}</span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>{Icons.chevronDown}</span>
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          {options.map(option => (
            <button
              key={option.value}
              className={`dropdown-option ${value === option.value ? 'selected' : ''}`}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type Network = 'devnet' | 'mainnet-beta'
type FilterType = 'all' | 'reclaimable' | 'closeable'

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)} `
}

function App() {
  const [address, setAddress] = useState('')
  const [network, setNetwork] = useState<Network>('devnet')
  const [customRpc, setCustomRpc] = useState(() => localStorage.getItem('solvent_rpc') || '')
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<SponsoredAccount[]>([])
  const [stats, setStats] = useState<RentStats | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [error, setError] = useState<string | null>(null)

  // Scan function - uses @solvent/core shared library
  const handleScan = useCallback(async () => {
    if (!address) return

    setLoading(true)
    setError(null)

    try {
      // Get custom RPC URL if provided for mainnet
      let rpcUrl: string | undefined
      if (network === 'mainnet-beta' && customRpc) {
        rpcUrl = customRpc
      }

      // Use core library functions with options object
      const scanOptions = { limit: 100, rpcUrl }
      const creations = await scanAndParseAccounts(address, network, scanOptions)
      const classifiedAccounts = await classifyAccounts(creations, address, network, rpcUrl)
      const stats = calculateRentStats(classifiedAccounts)

      setAccounts(classifiedAccounts)
      setStats(stats)

    } catch (e: any) {
      setError(e.message || 'Failed to scan')
    } finally {
      setLoading(false)
    }
  }, [address, network, customRpc])

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
        <h1 className="header-title">
          <span className="header-icon">🧪</span>
          <span>Solvent</span>
        </h1>
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
        <NetworkDropdown
          value={network}
          onChange={(val) => setNetwork(val as Network)}
        />
        <button
          className="scan-button"
          onClick={handleScan}
          disabled={loading || !address}
        >
          {loading ? 'Scanning...' : 'Scan'}
        </button>
      </div>

      {/* Custom RPC for Mainnet */}
      {network === 'mainnet-beta' && (
        <div className="rpc-container">
          <input
            type="text"
            className="rpc-input"
            placeholder="Custom RPC URL (optional, e.g. Helius)"
            value={customRpc}
            onChange={(e) => {
              setCustomRpc(e.target.value)
              localStorage.setItem('solvent_rpc', e.target.value)
            }}
          />
          <span className="rpc-hint">⚠️ Public mainnet RPC has rate limits. Enter your RPC for better results.</span>
        </div>
      )}

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
                    <span className={`badge ${account.status === 'CLOSEABLE' ? 'closeable' : 'active'} `}>
                      <span className="badge-icon">{account.status === 'CLOSEABLE' ? Icons.check : Icons.lock}</span>
                      {account.status === 'CLOSEABLE' ? 'Closeable' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${account.classification === 'RECLAIMABLE' ? 'reclaimable' : 'monitor'} `}>
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
