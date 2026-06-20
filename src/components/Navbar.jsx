import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Menu, X, LogOut, Settings, User, Briefcase } from 'lucide-react'

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <Briefcase size={24} style={{marginRight: '8px', display: 'inline-block'}} />
          CPMS
        </Link>

        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className={`nav-menu ${menuOpen ? 'active' : ''}`}>
          <Link to="/" className="nav-link">Dashboard</Link>
          <Link to="/inventory" className="nav-link">Inventory</Link>
          <Link to="/custodians" className="nav-link">Custodians</Link>
          <Link to="/transactions" className="nav-link">Transactions</Link>
          <Link to="/reports" className="nav-link">Reports</Link>
          
          <div className="nav-user-menu">
            <span className="nav-user-name">{user?.name}</span>
            <Link to="/profile" className="nav-link nav-icon">
              <User size={18} />
            </Link>
            <Link to="/settings" className="nav-link nav-icon">
              <Settings size={18} />
            </Link>
            <button className="nav-logout-btn" onClick={handleLogout}>
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
