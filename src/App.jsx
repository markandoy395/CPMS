import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PrivateRoute } from './components/PrivateRoute'
import { RoleRoute } from './components/RoleRoute'
import { Sidebar } from './components/Sidebar'

// Pages
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import Dashboard from './pages/Dashboard'
import InventoryPage from './pages/InventoryPage'
import CustodianPage from './pages/CustodianPage'
import TransactionsPage from './pages/TransactionsPage'
import ReportsPage from './pages/ReportsPage'
import UserManagementPage from './pages/UserManagementPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import RisFormPage from './pages/RisFormPage'
import OperationsPage from './pages/OperationsPage'

import './styles/index.css'

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Protected Routes */}
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <div className="app-layout">
                  <Sidebar />
                  <main className="main-content">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/inventory" element={<InventoryPage />} />
                      <Route path="/custodians" element={<CustodianPage />} />
                      <Route path="/transactions" element={<TransactionsPage />} />
                      <Route path="/operations" element={<OperationsPage />} />
                      <Route path="/ris-form" element={<RisFormPage />} />
                      <Route path="/reports" element={<RoleRoute roles={['Admin', 'Auditor']}><ReportsPage /></RoleRoute>} />
                      <Route path="/users" element={<RoleRoute roles={['Admin']}><UserManagementPage /></RoleRoute>} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                </div>
              </PrivateRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
