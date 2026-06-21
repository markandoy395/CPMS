import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Users,
  Repeat,
  FileText,
  ClipboardList,
  Wrench,
  Settings,
  LogOut,
  Briefcase,
  User
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export function Sidebar() {
  const location = useLocation()
  const { logout, user } = useAuth()

  const isActive = (path) => location.pathname === path

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/inventory', label: 'Inventory', icon: Package },
    { path: '/custodians', label: 'Custodians', icon: Users },
    { path: '/transactions', label: 'Transactions', icon: Repeat },
    { path: '/operations', label: 'Operations', icon: Wrench },
    { path: '/ris-form', label: 'RIS Form', icon: ClipboardList },
    { path: '/reports', label: 'Reports', icon: FileText, roles: ['Admin', 'Auditor'] },
    { path: '/users', label: 'Users', icon: Users, roles: ['Admin'] },
    { path: '/profile', label: 'Profile', icon: User },
    { path: '/settings', label: 'Settings', icon: Settings }
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Briefcase size={28} className="logo-icon" />
        <span className="logo-text">CPMS</span>
      </div>

      <nav className="sidebar-nav">
        {menuItems.filter(item => !item.roles || item.roles.includes(user?.role)).map(item => {
          const Icon = item.icon
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <button className="sidebar-logout" onClick={handleLogout}>
        <LogOut size={20} />
        <span>Logout</span>
      </button>
    </aside>
  )
}
