import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Lock, Mail, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { AuthVisualPanel } from '../components/AuthVisualPanel'
import { ErrorAlert } from '../components/ErrorAlert'
import logoSrc from '../../assets/image/logo.png'

export default function SignupPage() {
  const navigate = useNavigate()
  const { signup } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    const result = await signup(
      formData.email,
      formData.password,
      formData.name
    )

    if (result.success) {
      navigate('/login')
    } else {
      setError(result.message || 'Signup failed')
    }

    setLoading(false)
  }

  return (
    <div className="auth-page auth-page-signup">
      <div className="auth-shell">
        <section className="auth-form-panel">
          <div className="auth-brand">
            <img src={logoSrc} alt="CPMS - Custodial Property Management System" className="auth-brand-logo" />
          </div>

          <div className="auth-header">
            <span className="auth-eyebrow">Basic access</span>
            <h1>Create an account</h1>
            <p>Register for CPMS access to manage assigned property records and requests.</p>
          </div>

          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError('')}
            />
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label>Full Name</label>
              <div className="auth-input-wrap">
                <User size={18} />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email</label>
              <div className="auth-input-wrap">
                <Mail size={18} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
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
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 8 characters"
                  minLength="8"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <div className="auth-input-wrap">
                <Lock size={18} />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  minLength="8"
                  required
                />
              </div>
            </div>

            <div className="auth-access-note">
              <strong>Account type: Custodian</strong>
              <span>Higher roles are assigned through User Management by an authorized administrator.</span>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          <div className="auth-footer">
            <p>Already have an account? <Link to="/login">Login</Link></p>
          </div>
        </section>

        <AuthVisualPanel />
      </div>
    </div>
  )
}
