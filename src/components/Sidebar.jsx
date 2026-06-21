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
  User
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export function Sidebar() {
  const location = useLocation()
  const { logout, user } = useAuth()
  const userInitial = user?.name?.trim()?.charAt(0)?.toUpperCase()

  const isActive = (path) => location.pathname === path
  const canAccess = (item) => user?.role === 'Super Admin' || !item.roles || item.roles.includes(user?.role)

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
      <Link to="/profile" className="sidebar-user">
        <div className="sidebar-user-avatar" aria-hidden="true">
          {userInitial || <User size={22} />}
        </div>
        <div className="sidebar-user-details">
          <span className="sidebar-user-name">{user?.name || 'User'}</span>
          <span className="sidebar-user-role">{user?.role || 'Account'}</span>
        </div>
      </Link>

      <nav className="sidebar-nav">
        {menuItems.map(item => {
          const Icon = item.icon
          const allowed = canAccess(item)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-item ${isActive(item.path) ? 'active' : ''} ${allowed ? '' : 'disabled'}`}
              onClick={event => {
                if (!allowed) event.preventDefault()
              }}
              aria-disabled={!allowed}
              title={allowed ? item.label : 'Your role cannot access this section'}
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
