
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { ErrorAlert } from '../components/ErrorAlert'
import { SuccessAlert } from '../components/SuccessAlert'
import { Settings, Lock, Bell, Eye } from 'lucide-react'
import { profileService } from '../services/profileService'

export default function SettingsPage() {
  const { user, changePassword } = useAuth()
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [preferences, setPreferences] = useState({
    email_notifications: true,
    system_notifications: true,
    activity_log: true,
    item_updates: true,
    transaction_alerts: true,
    weekly_reports: false
  })
  const [databaseConnected, setDatabaseConnected] = useState(false)

  useEffect(() => {
    profileService.getPreferences().then(result => {
      if (result.success) {
        setPreferences(Object.fromEntries(Object.entries(result.data).map(([key, value]) => [key, ['1', 1, true].includes(value)])))
        setDatabaseConnected(true)
      }
    })
  }, [])

  const savePreferences = async () => {
    const result = await profileService.updatePreferences(preferences)
    if (result.success) setSuccess('Preferences saved successfully')
    else setError(result.message)
  }

  const handlePasswordChange = (e) => {
    const { name, value } = e.target
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    const result = await changePassword(passwordForm.currentPassword, passwordForm.newPassword)
    if (result.success) {
      setSuccess('Password changed successfully')
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } else {
      setError(result.message || 'Failed to change password')
    }

    setLoading(false)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

      <div className="settings-grid">
        <div className="card settings-card">
          <div className="settings-header">
            <Lock size={24} />
            <h3>Change Password</h3>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Current Password</label>
              <div className="password-input">
                <input
                  type={passwordVisible.current ? 'text' : 'password'}
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  placeholder="Enter current password"
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setPasswordVisible(prev => ({
                    ...prev,
                    current: !prev.current
                  }))}
                >
                  <Eye size={18} />
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>New Password</label>
              <div className="password-input">
                <input
                  type={passwordVisible.new ? 'text' : 'password'}
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="Enter new password"
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setPasswordVisible(prev => ({
                    ...prev,
                    new: !prev.new
                  }))}
                >
                  <Eye size={18} />
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <div className="password-input">
                <input
                  type={passwordVisible.confirm ? 'text' : 'password'}
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="Confirm new password"
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setPasswordVisible(prev => ({
                    ...prev,
                    confirm: !prev.confirm
                  }))}
                >
                  <Eye size={18} />
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>

        <div className="card settings-card">
          <div className="settings-header">
            <Settings size={24} />
            <h3>Preferences</h3>
          </div>
          <div className="preferences-list">
            <div className="preference-item">
              <span className="preference-label">Email Notifications</span>
              <input type="checkbox" checked={preferences.email_notifications} onChange={e => setPreferences({ ...preferences, email_notifications: e.target.checked })} className="preference-toggle" />
            </div>
            <div className="preference-item">
              <span className="preference-label">System Notifications</span>
              <input type="checkbox" checked={preferences.system_notifications} onChange={e => setPreferences({ ...preferences, system_notifications: e.target.checked })} className="preference-toggle" />
            </div>
            <div className="preference-item">
              <span className="preference-label">Activity Log</span>
              <input type="checkbox" checked={preferences.activity_log} onChange={e => setPreferences({ ...preferences, activity_log: e.target.checked })} className="preference-toggle" />
            </div>
            <button type="button" className="btn btn-primary" onClick={savePreferences}>Save Preferences</button>
          </div>
        </div>

        <div className="card settings-card">
          <div className="settings-header">
            <Bell size={24} />
            <h3>Notifications</h3>
          </div>
          <div className="notifications-list">
            <div className="notification-item">
              <input type="checkbox" id="item-updates" checked={preferences.item_updates} onChange={e => setPreferences({ ...preferences, item_updates: e.target.checked })} />
              <label htmlFor="item-updates">
                <span className="notification-title">Item Updates</span>
                <span className="notification-desc">Get notified when items are assigned or returned</span>
              </label>
            </div>
            <div className="notification-item">
              <input type="checkbox" id="transaction-alerts" checked={preferences.transaction_alerts} onChange={e => setPreferences({ ...preferences, transaction_alerts: e.target.checked })} />
              <label htmlFor="transaction-alerts">
                <span className="notification-title">Transaction Alerts</span>
                <span className="notification-desc">Receive alerts on new transactions</span>
              </label>
            </div>
            <div className="notification-item">
              <input type="checkbox" id="reports" checked={preferences.weekly_reports} onChange={e => setPreferences({ ...preferences, weekly_reports: e.target.checked })} />
              <label htmlFor="reports">
                <span className="notification-title">Weekly Reports</span>
                <span className="notification-desc">Receive weekly summary reports</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>System Information</h3>
        <div className="system-info">
          <div className="info-row">
            <span className="info-label">Application Version:</span>
            <span className="info-value">2.0.0</span>
          </div>
          <div className="info-row">
            <span className="info-label">Database:</span>
            <span className="info-value">XAMPP MariaDB</span>
          </div>
          <div className="info-row">
            <span className="info-label">Status:</span>
            <span className={`info-value ${databaseConnected ? 'text-success' : 'text-danger'}`}>{databaseConnected ? 'Connected' : 'Unavailable'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Last Backup:</span>
            <span className="info-value">Not configured</span>
          </div>
        </div>
      </div>
    </div>
  )
}
