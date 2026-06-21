import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  Coins,
  Package,
  Repeat2,
  TrendingUp,
  Users,
  Wrench
} from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorAlert } from '../components/ErrorAlert'
import { reportService } from '../services/reportService'

const DashboardCharts = lazy(() => import('../components/DashboardCharts'))

function numberValue(value) {
  return Number(value || 0)
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function buildTransactionTrend(rows = []) {
  const values = new Map(rows.map(row => [row.month, row]))
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - (5 - index))
    const row = values.get(monthKey(date)) || {}
    return {
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      Transactions: numberValue(row.total),
      Issuances: numberValue(row.issuances),
      Transfers: numberValue(row.transfers)
    }
  })
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadDashboardData = async () => {
      setError('')
      const result = await reportService.getSummary()
      if (result.success) setStats(result.data)
      else setError(result.message || 'Failed to load dashboard data')
      setLoading(false)
    }
    loadDashboardData()
  }, [])

  const categoryData = useMemo(() => (stats?.analytics?.categories || []).map(row => ({
    name: row.label,
    Assets: numberValue(row.value)
  })), [stats])

  const statusData = useMemo(() => (stats?.analytics?.statuses || []).map(row => ({
    name: row.label,
    value: numberValue(row.value)
  })), [stats])

  const trendData = useMemo(() => buildTransactionTrend(stats?.analytics?.transaction_trend), [stats])

  if (loading) return <LoadingSpinner message="Loading system data..." />

  const metrics = stats ? [
    { label: 'Total Assets', value: numberValue(stats.items.totalItems).toLocaleString(), icon: Package, tone: 'primary' },
    { label: 'Active Assets', value: numberValue(stats.items.activeCount).toLocaleString(), icon: Check, tone: 'success' },
    { label: 'Asset Value', value: `PHP ${numberValue(stats.items.totalValue).toLocaleString()}`, icon: Coins, tone: 'warning' },
    { label: 'Active Custodians', value: numberValue(stats.custodians.activeCustodians).toLocaleString(), icon: Users, tone: 'info' },
    { label: 'Transactions', value: numberValue(stats.transactions.totalTransactions).toLocaleString(), icon: Repeat2, tone: 'purple' },
    { label: 'Pending Maintenance', value: numberValue(stats.maintenance.pending).toLocaleString(), icon: Wrench, tone: 'danger' },
    { label: 'Unassigned Assets', value: numberValue(stats.items.notDistributedCount).toLocaleString(), icon: TrendingUp, tone: 'info' },
    { label: 'Damaged Assets', value: numberValue(stats.items.damageCount).toLocaleString(), icon: AlertCircle, tone: 'danger' }
  ] : []

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>College Property Management System overview</p>
        </div>
        <div className="dashboard-date">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      <section className="dashboard-section" aria-labelledby="dashboard-metrics-title">
        <div className="dashboard-section-header">
          <div><h2 id="dashboard-metrics-title">Key Metrics</h2><p>Current property and operational totals</p></div>
          <span>MariaDB live data</span>
        </div>
        <div className="metrics-grid">
          {metrics.map(metric => {
            const Icon = metric.icon
            return (
              <div className="metric-card" key={metric.label}>
                <div className={`metric-icon ${metric.tone}`}><Icon size={25} /></div>
                <div className="metric-content">
                  <p className="metric-label">{metric.label}</p>
                  <p className="metric-value">{metric.value}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-analytics-title">
        <div className="dashboard-section-header">
          <div><h2 id="dashboard-analytics-title">Visual Analytics</h2><p>Distribution and activity from recorded inventory data</p></div>
        </div>

        <Suspense fallback={<div className="dashboard-chart-loading">Loading visual analytics...</div>}>
          <DashboardCharts
            trendData={trendData}
            categoryData={categoryData}
            statusData={statusData}
            totalAssets={numberValue(stats?.items?.totalItems)}
          />
        </Suspense>
      </section>

      <div className="dashboard-system-strip">
        <div><span>System</span><strong>CPMS 2.0.0</strong></div>
        <div><span>Database</span><strong>MariaDB via XAMPP</strong></div>
        <div><span>Updated</span><strong>{stats?.generated_at ? new Date(stats.generated_at).toLocaleString() : 'Unavailable'}</strong></div>
        <div><span>Status</span><strong className="dashboard-operational"><i /> Operational</strong></div>
      </div>
    </div>
  )
}
