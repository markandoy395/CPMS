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

const STATUS_COLORS = ['#176ea6', '#168447', '#b66a08', '#c93636', '#7454a6', '#47707a']

function ChartEmptyState({ message }) {
  return <div className="dashboard-chart-empty"><TrendingUp size={26} /><span>{message}</span></div>
}

export default function DashboardCharts({ trendData, categoryData, statusData, totalAssets }) {
  return (
    <div className="dashboard-analytics-grid">
      <article className="dashboard-chart-panel dashboard-chart-wide">
        <div className="dashboard-chart-header"><h3>Transaction Activity</h3><span>Last 6 months</span></div>
        <div className="dashboard-chart-body">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#e5eaf0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#657486', fontSize: 12 }} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#657486', fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 6, border: '1px solid #d8e1ea', fontFamily: 'Poppins' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Transactions" stroke="#176ea6" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Issuances" stroke="#168447" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Transfers" stroke="#b66a08" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="dashboard-chart-panel">
        <div className="dashboard-chart-header"><h3>Assets by Category</h3><span>{categoryData.length} categories</span></div>
        <div className="dashboard-chart-body">
          {categoryData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 8, right: 8, left: -20, bottom: 16 }}>
                <CartesianGrid stroke="#e5eaf0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={55} tick={{ fill: '#657486', fontSize: 10 }} tickFormatter={value => value.length > 12 ? `${value.slice(0, 11)}...` : value} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#657486', fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#f2f6f8' }} contentStyle={{ borderRadius: 6, border: '1px solid #d8e1ea', fontFamily: 'Poppins' }} />
                <Bar dataKey="Assets" fill="#176ea6" radius={[4, 4, 0, 0]} maxBarSize={54} />
              </BarChart>
            </ResponsiveContainer>
          ) : <ChartEmptyState message="No inventory categories yet" />}
        </div>
      </article>

      <article className="dashboard-chart-panel">
        <div className="dashboard-chart-header"><h3>Asset Status</h3><span>{totalAssets} total</span></div>
        <div className="dashboard-chart-body">
          {statusData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius="42%" outerRadius="68%" paddingAngle={2}>
                  {statusData.map((entry, index) => <Cell key={entry.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 6, border: '1px solid #d8e1ea', fontFamily: 'Poppins' }} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <ChartEmptyState message="No asset status data yet" />}
        </div>
      </article>
    </div>
  )
}
