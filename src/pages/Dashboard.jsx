import React, { useState, useEffect } from 'react'
import { Package, Check, Users, Coins, Repeat2, AlertCircle, TrendingUp, CheckCircle } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorAlert } from '../components/ErrorAlert'
import { itemService } from '../services/itemService'
import { custodianService } from '../services/custodianService'
import { transactionService } from '../services/transactionService'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setError('')
      const [itemsResult, custodiansResult, transactionsResult] = await Promise.all([
        itemService.getItemStats(),
        custodianService.getCustodianStats(),
        transactionService.getTransactionStats()
      ])

      if (itemsResult.success && custodiansResult.success && transactionsResult.success) {
        setStats({
          items: itemsResult.stats,
          custodians: custodiansResult.stats,
          transactions: transactionsResult.stats
        })
      } else {
        setError('Failed to load dashboard data')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSpinner message="Loading system data..." />

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>College Property Management System Overview</p>
        </div>
        <div className="dashboard-date">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {error && (
        <ErrorAlert
          message={error}
          onClose={() => setError('')}
        />
      )}

      {/* Key Metrics Section */}
      <div className="dashboard-section">
        <h2 className="section-title">Key Metrics</h2>
        <div className="metrics-grid">
          {stats && (
            <>
              <div className="metric-card">
                <div className="metric-icon primary">
                  <Package size={32} />
                </div>
                <div className="metric-content">
                  <p className="metric-label">Total Assets</p>
                  <p className="metric-value">{stats.items.totalItems}</p>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon success">
                  <Check size={32} />
                </div>
                <div className="metric-content">
                  <p className="metric-label">Active Assets</p>
                  <p className="metric-value">{stats.items.activeCount}</p>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon info">
                  <Users size={32} />
                </div>
                <div className="metric-content">
                  <p className="metric-label">Property Custodians</p>
                  <p className="metric-value">{stats.custodians.activeCustodians}</p>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon warning">
                  <Coins size={32} />
                </div>
                <div className="metric-content">
                  <p className="metric-label">Total Asset Value</p>
                  <p className="metric-value">₱{(stats.items.totalValue || 0).toLocaleString()}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Operations Section */}
      <div className="dashboard-section">
        <h2 className="section-title">Operations Overview</h2>
        <div className="metrics-grid">
          {stats && (
            <>
              <div className="metric-card">
                <div className="metric-icon purple">
                  <Repeat2 size={32} />
                </div>
                <div className="metric-content">
                  <p className="metric-label">Total Transactions</p>
                  <p className="metric-value">{stats.transactions.totalTransactions}</p>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon danger">
                  <AlertCircle size={32} />
                </div>
                <div className="metric-content">
                  <p className="metric-label">Items for Return</p>
                  <p className="metric-value">{stats.items.damageCount}</p>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon info">
                  <TrendingUp size={32} />
                </div>
                <div className="metric-content">
                  <p className="metric-label">Unassigned Items</p>
                  <p className="metric-value">{stats.items.notDistributedCount}</p>
                </div>
              </div>
              <div className="metric-card">
                <div className="metric-icon success">
                  <CheckCircle size={32} />
                </div>
                <div className="metric-content">
                  <p className="metric-label">System Status</p>
                  <p className="metric-value">Operational</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards Section */}
      <div className="dashboard-grid">
        <div className="card dashboard-card">
          <div className="card-header">
            <h3>Asset Inventory Summary</h3>
          </div>
          {stats && (
            <div className="card-content">
              <div className="summary-item">
                <span className="summary-label">Total Assets</span>
                <span className="summary-value">{stats.items.totalItems}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Asset Value</span>
                <span className="summary-value text-primary">₱{(stats.items.totalValue || 0).toLocaleString()}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Assigned Items</span>
                <span className="summary-value">{stats.items.assigned || 0}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Unassigned Items</span>
                <span className="summary-value text-warning">{stats.items.notDistributedCount || 0}</span>
              </div>
            </div>
          )}
        </div>

        <div className="card dashboard-card">
          <div className="card-header">
            <h3>Custodian Administration</h3>
          </div>
          {stats && (
            <div className="card-content">
              <div className="summary-item">
                <span className="summary-label">Active Custodians</span>
                <span className="summary-value text-success">{stats.custodians.activeCustodians}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Transactions</span>
                <span className="summary-value">{stats.transactions.totalTransactions}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Items for Maintenance</span>
                <span className="summary-value text-danger">{stats.items.damageCount || 0}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Pending Verification</span>
                <span className="summary-value text-info">0</span>
              </div>
            </div>
          )}
        </div>

        <div className="card dashboard-card">
          <div className="card-header">
            <h3>System Information</h3>
          </div>
          <div className="card-content">
            <div className="summary-item">
              <span className="summary-label">System Version</span>
              <span className="summary-value">2.0.0</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">System Status</span>
              <span className="summary-value text-success">● Operational</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Database Engine</span>
              <span className="summary-value">Supabase PostgreSQL</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Last Updated</span>
              <span className="summary-value">{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
