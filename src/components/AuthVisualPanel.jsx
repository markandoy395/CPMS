import React from 'react'
import { ClipboardCheck, FileText, PackageCheck, ShieldCheck } from 'lucide-react'

export function AuthVisualPanel() {
  return (
    <aside className="auth-visual-panel" aria-label="CPMS system overview">
      <div className="auth-pattern auth-pattern-top" />
      <div className="auth-pattern auth-pattern-bottom" />

      <div className="auth-analytics-card">
        <div className="auth-card-toolbar">
          <div>
            <span>CPMS Analytics</span>
            <strong>Property Activity</strong>
          </div>
          <div className="auth-card-tabs">
            <span>Assets</span>
            <span>RIS</span>
            <span>Audit</span>
          </div>
        </div>

        <div className="auth-chart-lines">
          <svg viewBox="0 0 420 150" role="img" aria-label="Sample property activity chart">
            <path className="chart-grid-line" d="M12 26H408" />
            <path className="chart-grid-line" d="M12 66H408" />
            <path className="chart-grid-line" d="M12 106H408" />
            <path className="chart-line-muted" d="M20 120L92 44L164 82L236 58L308 76L400 36" />
            <path className="chart-line-strong" d="M20 94L92 72L164 50L236 78L308 66L400 54" />
          </svg>
        </div>

        <div className="auth-metric-row">
          <div><span>Total Assets</span><strong>1,248</strong></div>
          <div><span>Active Custodians</span><strong>86</strong></div>
          <div><span>Open RIS</span><strong>12</strong></div>
        </div>
      </div>

      <div className="auth-progress-card">
        <div className="auth-progress-ring">
          <span>84%</span>
        </div>
        <div>
          <span>Verified</span>
          <strong>Inventory records</strong>
        </div>
      </div>

      <div className="auth-visual-copy">
        <h2>Custodial Property Management System</h2>
        <p>
          Track assets, custodians, RIS forms, transfers, maintenance, and audit-ready
          reports in one secure workspace.
        </p>
      </div>

      <div className="auth-feature-list">
        <span><PackageCheck size={16} /> Asset Registry</span>
        <span><ClipboardCheck size={16} /> Custodian Tracking</span>
        <span><FileText size={16} /> PAR, ICS, RIS Forms</span>
        <span><ShieldCheck size={16} /> Audit Logs</span>
      </div>
    </aside>
  )
}
