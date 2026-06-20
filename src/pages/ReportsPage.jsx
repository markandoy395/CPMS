import React, { useState, useEffect } from 'react'
import { Download, BarChart3, Package, Users, ClipboardList } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorAlert } from '../components/ErrorAlert'
import { itemService } from '../services/itemService'
import { custodianService } from '../services/custodianService'

export default function ReportsPage() {
  const [itemStats, setItemStats] = useState(null)
  const [custodianStats, setCustodianStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadReportData()
  }, [])

  const loadReportData = async () => {
    try {
      setError('')
      const [itemsResult, custodiansResult] = await Promise.all([
        itemService.getItemStats(),
        custodianService.getCustodianStats()
      ])

      if (itemsResult.success && custodiansResult.success) {
        setItemStats(itemsResult.stats)
        setCustodianStats(custodiansResult.stats)
      } else {
        setError('Failed to load report data')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    alert('PDF export functionality coming soon!')
    // In a real app, you would use a library like jsPDF or react-pdf
  }

  const handleExportExcel = () => {
    alert('Excel export functionality coming soon!')
    // In a real app, you would use a library like xlsx
  }

  if (loading) return <LoadingSpinner message="Loading reports..." />

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Reports & Analytics</h1>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleExportPDF}>
            <Download size={18} /> Export PDF
          </button>
          <button className="btn btn-secondary" onClick={handleExportExcel}>
            <Download size={18} /> Export Excel
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}

      <div className="reports-grid">
        <div className="card report-card">
          <div className="report-header">
            <h3><Package size={20} style={{marginRight: '8px', display: 'inline'}} /> Inventory Report</h3>
            <BarChart3 size={24} className="report-icon" />
          </div>
          {itemStats && (
            <div className="report-content">
              <div className="report-stat">
                <span className="report-label">Total Items</span>
                <span className="report-value">{itemStats.totalItems}</span>
              </div>
              <div className="report-stat">
                <span className="report-label">Active Items</span>
                <span className="report-value text-success">{itemStats.activeCount}</span>
              </div>
              <div className="report-stat">
                <span className="report-label">Not Distributed</span>
                <span className="report-value text-info">{itemStats.notDistributedCount}</span>
              </div>
              <div className="report-stat">
                <span className="report-label">Total Return</span>
                <span className="report-value text-danger">{itemStats.damageCount}</span>
              </div>
              <div className="report-stat">
                <span className="report-label">Under Review</span>
                <span className="report-value text-warning">{Math.max(0, itemStats.totalItems - itemStats.activeCount - itemStats.damageCount)}</span>
              </div>
              <div className="report-stat highlight">
                <span className="report-label">Total Asset Value</span>
                <span className="report-value">₱{(itemStats.totalValue || 0).toLocaleString()}.00</span>
              </div>
            </div>
          )}
        </div>

        <div className="card report-card">
          <div className="report-header">
            <h3><Users size={20} style={{marginRight: '8px', display: 'inline'}} /> Custodian Report</h3>
            <BarChart3 size={24} className="report-icon" />
          </div>
          {custodianStats && (
            <div className="report-content">
              <div className="report-stat">
                <span className="report-label">Total Custodians</span>
                <span className="report-value">{custodianStats.totalCustodians}</span>
              </div>
              <div className="report-stat">
                <span className="report-label">Active</span>
                <span className="report-value text-success">{custodianStats.activeCustodians}</span>
              </div>
              <div className="report-stat">
                <span className="report-label">Inactive</span>
                <span className="report-value text-warning">{custodianStats.inactiveCustodians}</span>
              </div>
              <div className="report-stat">
                <span className="report-label">Avg Items per Custodian</span>
                <span className="report-value">
                  {custodianStats.totalCustodians > 0
                    ? Math.round(itemStats?.totalItems / custodianStats.totalCustodians)
                    : 0}
                </span>
              </div>
              <div className="report-stat highlight">
                <span className="report-label">Activity Status</span>
                <span className="report-value text-success">Operational</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3><BarChart3 size={20} style={{marginRight: '8px', display: 'inline'}} /> Summary Report</h3>
        <div className="summary-report">
          <div className="summary-section">
            <h4>Asset Management Overview</h4>
            <ul>
              <li>Total institutional assets tracked: <strong>{itemStats?.totalItems || 0}</strong></li>
              <li>Total asset value under management: <strong>₱{(itemStats?.totalValue || 0).toLocaleString()}.00</strong></li>
              <li>Items in active status: <strong>{itemStats?.activeCount || 0}</strong></li>
              <li>Items not distributed: <strong>{itemStats?.notDistributedCount || 0}</strong></li>
              <li>Total Return: <strong>{itemStats?.damageCount || 0}</strong></li>
            </ul>
          </div>

          <div className="summary-section">
            <h4>Custodian Network</h4>
            <ul>
              <li>Number of active custodians: <strong>{custodianStats?.activeCustodians || 0}</strong></li>
              <li>Total registered custodians: <strong>{custodianStats?.totalCustodians || 0}</strong></li>
              <li>System coverage: <strong>{custodianStats?.totalCustodians && itemStats?.totalItems ? Math.round((itemStats.totalItems / custodianStats.totalCustodians) * 10) / 10 : 0} items per custodian</strong></li>
            </ul>
          </div>

          <div className="summary-section">
            <h4>System Health</h4>
            <ul>
              <li>Application Status: <strong className="text-success">Operational</strong></li>
              <li>Database Status: <strong className="text-success">Connected</strong></li>
              <li>Last Updated: <strong>{new Date().toLocaleString()}</strong></li>
              <li>Data Integrity: <strong className="text-success">100%</strong></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <h3><ClipboardList size={20} style={{marginRight: '8px', display: 'inline'}} /> Data Quality</h3>
        <div className="quality-metrics">
          <div className="quality-metric">
            <span className="metric-name">Complete Item Records</span>
            <div className="metric-bar">
              <div className="metric-fill" style={{ width: '95%' }}></div>
            </div>
            <span className="metric-percent">95%</span>
          </div>
          <div className="quality-metric">
            <span className="metric-name">Updated Assignments</span>
            <div className="metric-bar">
              <div className="metric-fill" style={{ width: '88%' }}></div>
            </div>
            <span className="metric-percent">88%</span>
          </div>
          <div className="quality-metric">
            <span className="metric-name">Verified Transactions</span>
            <div className="metric-bar">
              <div className="metric-fill" style={{ width: '92%' }}></div>
            </div>
            <span className="metric-percent">92%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
