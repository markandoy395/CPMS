import React from 'react'
import { TrendingUp } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

const STATUS_COLORS = {
  Active: 'var(--success)',
  Assigned: 'var(--primary)',
  Borrowed: 'var(--info)',
  'In Repair': 'var(--warning)',
  Returned: 'var(--primary-dark)',
  Disposed: 'var(--purple)',
  Lost: 'var(--danger)'
}
const CHART_COLORS = {
  grid: 'var(--border)',
  text: 'var(--text-secondary)',
  cursor: 'rgba(var(--primary-rgb), 0.35)',
  cursorFill: 'var(--primary-light)',
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  info: 'var(--info)',
  fallback: 'var(--primary)',
  white: '#ffffff'
}
const RESPONSIVE_CHART_PROPS = {
  width: '100%',
  height: '100%',
  minWidth: 0,
  minHeight: 260,
  initialDimension: { width: 320, height: 290 },
  debounce: 50
}

function ChartEmptyState({ message }) {
  return <div className="dashboard-chart-empty"><TrendingUp size={26} /><span>{message}</span></div>
}

function DashboardChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const tooltipColor = payload.length === 1
    ? payload[0].color || payload[0].payload?.fill || CHART_COLORS.fallback
    : CHART_COLORS.fallback

  return (
    <div className="dashboard-chart-tooltip" style={{ '--chart-tooltip-color': tooltipColor }}>
      {label && <strong>{label}</strong>}
      {payload.map(entry => (
        <div className="dashboard-chart-tooltip-row" key={`${entry.name}-${entry.value}`}>
          <i style={{ backgroundColor: entry.color || entry.payload?.fill || CHART_COLORS.white }} />
          <span>{entry.name}</span>
          <b>{Number(entry.value || 0).toLocaleString()}</b>
        </div>
      ))}
    </div>
  )
}

export default function DashboardCharts({ trendData, categoryData, statusData, totalAssets, rangeLabel = 'Last 6 months' }) {
  return (
    <div className="dashboard-analytics-grid">
      <article className="dashboard-chart-panel dashboard-chart-wide">
        <div className="dashboard-chart-header"><h3>Transaction Activity</h3><span>{rangeLabel}</span></div>
        <div className="dashboard-chart-body">
          <ResponsiveContainer {...RESPONSIVE_CHART_PROPS}>
            <LineChart data={trendData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: CHART_COLORS.text, fontSize: 12 }} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: CHART_COLORS.text, fontSize: 12 }} />
              <Tooltip content={<DashboardChartTooltip />} cursor={{ stroke: CHART_COLORS.cursor, strokeDasharray: '4 4' }} offset={0} allowEscapeViewBox={{ x: true, y: true }} isAnimationActive={false} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Transactions" stroke={CHART_COLORS.primary} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Issuances" stroke={CHART_COLORS.success} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Transfers" stroke={CHART_COLORS.warning} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Borrowings" stroke={CHART_COLORS.info} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="dashboard-chart-panel">
        <div className="dashboard-chart-header"><h3>Assets by Category</h3><span>{categoryData.length} categories</span></div>
        <div className="dashboard-chart-body">
          {categoryData.length ? (
            <ResponsiveContainer {...RESPONSIVE_CHART_PROPS}>
              <BarChart data={categoryData} margin={{ top: 8, right: 8, left: -20, bottom: 16 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={55} tick={{ fill: CHART_COLORS.text, fontSize: 10 }} tickFormatter={value => value.length > 12 ? `${value.slice(0, 11)}...` : value} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: CHART_COLORS.text, fontSize: 12 }} />
                <Tooltip cursor={{ fill: CHART_COLORS.cursorFill }} content={<DashboardChartTooltip />} offset={0} allowEscapeViewBox={{ x: true, y: true }} isAnimationActive={false} />
                <Bar dataKey="Assets" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={54} />
              </BarChart>
            </ResponsiveContainer>
          ) : <ChartEmptyState message="No inventory categories yet" />}
        </div>
      </article>

      <article className="dashboard-chart-panel">
        <div className="dashboard-chart-header"><h3>Asset Status</h3><span>{totalAssets} total</span></div>
        <div className="dashboard-chart-body">
          {statusData.length ? (
            <ResponsiveContainer {...RESPONSIVE_CHART_PROPS}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius="42%" outerRadius="68%" paddingAngle={2}>
                  {statusData.map(entry => <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || CHART_COLORS.text} />)}
                </Pie>
                <Tooltip content={<DashboardChartTooltip />} offset={0} allowEscapeViewBox={{ x: true, y: true }} isAnimationActive={false} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <ChartEmptyState message="No asset status data yet" />}
        </div>
      </article>
    </div>
  )
}
