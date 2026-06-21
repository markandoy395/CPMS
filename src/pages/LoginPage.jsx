import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { AuthVisualPanel } from '../components/AuthVisualPanel'
import { ErrorAlert } from '../components/ErrorAlert'
import logoSrc from '../../assets/image/logo.png'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(email, password)

    if (result.success) {
      navigate('/')
    } else {
      setError(result.message || 'Login failed')
    }

    setLoading(false)
  }

  return (
    <div className="auth-page auth-page-login">
      <div className="auth-shell">
        <section className="auth-form-panel">
          <div className="auth-brand">
            <img src={logoSrc} alt="CPMS - Custodial Property Management System" className="auth-brand-logo" />
          </div>

          <div className="auth-header">
            <span className="auth-eyebrow">Welcome back</span>
            <h1>Login to your account</h1>
            <p>Access property records, custodian assignments, and system reports.</p>
          </div>

          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError('')}
            />
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>Email</label>
              <div className="auth-input-wrap">
                <Mail size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="auth-input-wrap">
                <Lock size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="auth-footer">
            <p>Need custodian access? <Link to="/signup">Create an account</Link></p>
          </div>
        </section>

        <AuthVisualPanel />
      </div>
    </div>
  )
}
