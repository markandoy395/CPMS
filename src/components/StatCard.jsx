import React from 'react'

export function StatCard({ icon, label, value, colorType = 'primary', variant = 'default' }) {
  return (
    <div className={`stat-card stat-card-${colorType} stat-card-${variant}`}>
      <div className={`stat-icon-box stat-icon-box-${colorType}`}>
        {icon}
      </div>
      <div className="stat-content">
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
      </div>
    </div>
  )
}
