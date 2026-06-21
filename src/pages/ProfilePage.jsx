import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { ErrorAlert } from '../components/ErrorAlert'
import { SuccessAlert } from '../components/SuccessAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { User, Mail, Phone, MapPin, Lock, Bell, Activity, LogIn, Download, Shield } from 'lucide-react'
import { profileService } from '../services/profileService'

export default function ProfilePage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    bio: ''
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [preferences, setPreferences] = useState(null)
  const [loginHistory, setLoginHistory] = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [securitySummary, setSecuritySummary] = useState(null)
  const [roleStats, setRoleStats] = useState(null)
  const profileName = profileData?.name || user?.name || 'User'
  const profileEmail = profileData?.email || user?.email || 'No email available'
  const profileInitial = profileName.trim().charAt(0).toUpperCase()
  const profileStatus = profileData?.status || 'N/A'

  useEffect(() => {
    loadProfileData()
  }, [user?.id])

  const loadProfileData = async () => {
    try {
      setLoading(true)
      setError('')

      // Load full profile data
      const profileResult = await profileService.getFullProfile(user?.id)
      if (profileResult.success) {
        setProfileData(profileResult.data.profile)
        setFormData(prev => ({
          ...prev,
          ...profileResult.data.profile
        }))
        setLoginHistory(profileResult.data.loginHistory)
        setActivityLog(profileResult.data.activityLog)
        setPreferences(profileResult.data.preferences)
      }

      // Load security summary
      const securityResult = await profileService.getSecuritySummary(user?.id)
      if (securityResult.success) {
        setSecuritySummary(securityResult.data)
      }

      // Load role-specific stats
      const statsResult = await profileService.getRoleStats(user?.id, user?.role)
      if (statsResult.success) {
        setRoleStats(statsResult.data)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleProfileChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const result = await profileService.updateProfileInfo(user?.id, formData)
    if (result.success) {
      setSuccess('Profile updated successfully')
      setProfileData(result.data)
    } else {
      setError(result.message)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match')
      return
    }

    const result = await profileService.updatePassword(
      user?.id,
      passwordForm.currentPassword,
      passwordForm.newPassword
    )

    if (result.success) {
      setSuccess('Password updated successfully')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } else {
      setError(result.message)
    }
  }

  const handleExportData = async () => {
    setError('')
    const result = await profileService.exportProfileData(user?.id)
    if (result.success) {
      const jsonString = JSON.stringify(result.data, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `profile-data-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      setSuccess('Profile data exported successfully')
    } else {
      setError(result.message)
    }
  }

  const handlePreferenceChange = async (field, checked) => {
    const updated = { ...preferences, [field]: checked }
    setPreferences(updated)
    const result = await profileService.updatePreferences(updated)
    if (!result.success) setError(result.message)
  }

  if (loading) return <LoadingSpinner />

  const getRoleSpecificSection = () => {
    switch (user?.role) {
      case 'Custodian':
        return (
          <div className="card">
            <h3>Custodian Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Department:</span>
                <span className="info-value">{roleStats?.department || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Items Managed:</span>
                <span className="info-value">{roleStats?.total_items || 0}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Items In Good Condition:</span>
                <span className="info-value">{roleStats?.items_good_condition || 0}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Pending Maintenance:</span>
                <span className="info-value">{roleStats?.pending_maintenance || 0}</span>
              </div>
            </div>
          </div>
        )
      case 'Super Admin':
      case 'Admin':
        return (
          <div className="card">
            <h3>{user?.role} Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Permission Level:</span>
                <span className="info-value">{user?.role === 'Super Admin' ? 'Full System and Role Access' : 'Full System Access'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Users Managed:</span>
                <span className="info-value">{roleStats?.users_managed || 0}</span>
              </div>
              <div className="info-item">
                <span className="info-label">System Audits:</span>
                <span className="info-value">{roleStats?.audits_conducted || 0}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Last Security Check:</span>
                <span className="info-value">{roleStats?.last_security_check || 'N/A'}</span>
              </div>
            </div>
          </div>
        )
      case 'Auditor':
        return (
          <div className="card">
            <h3>Auditor Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Audit Scope:</span>
                <span className="info-value">{roleStats?.audit_scope || 'Multi-Department'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Audits Completed:</span>
                <span className="info-value">{roleStats?.audits_completed || 0}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Current Audits:</span>
                <span className="info-value">{roleStats?.current_audits || 0}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Compliance Rate:</span>
                <span className="info-value">{roleStats?.compliance_rate || 'N/A'}%</span>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>My Profile - {user?.role}</h1>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

      {/* Profile Navigation Tabs */}
      <div className="profile-tabs">
        <button
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <User size={18} /> Profile
        </button>
        <button
          className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <Lock size={18} /> Security
        </button>
        <button
          className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <Bell size={18} /> Notifications
        </button>
        <button
          className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <Activity size={18} /> Activity
        </button>
      </div>

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <div className="profile-content">
          <div className="profile-grid">
            <div className="card profile-info profile-summary-card">
              <div className="profile-summary-header">
                <span>Account Profile</span>
                <h3>Profile Information</h3>
              </div>

              <div className="profile-summary-identity">
                <div className="profile-avatar profile-summary-avatar">
                  {profileInitial || <User size={42} />}
                </div>
                <div>
                  <strong>{profileName}</strong>
                  <span>{profileEmail}</span>
                </div>
              </div>

              <div className="profile-summary-list">
                <div className="info-row profile-summary-row">
                  <span className="info-label">Name</span>
                  <span className="info-value">{profileName}</span>
                </div>
                <div className="info-row profile-summary-row">
                  <span className="info-label">Email</span>
                  <span className="info-value">{profileEmail}</span>
                </div>
                <div className="info-row profile-summary-row">
                  <span className="info-label">Role</span>
                  <span className="info-value profile-summary-pill">{profileData?.role || 'N/A'}</span>
                </div>
                <div className="info-row profile-summary-row">
                  <span className="info-label">Status</span>
                  <span className={`info-value profile-summary-pill ${profileStatus.toLowerCase() === 'active' ? 'is-active' : ''}`}>{profileStatus}</span>
                </div>
                <div className="info-row profile-summary-row">
                  <span className="info-label">Member Since</span>
                  <span className="info-value">
                    {profileData?.created_at
                      ? new Date(profileData.created_at).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="card profile-form">
              <h3>Edit Profile Information</h3>
              <form onSubmit={handleProfileSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleProfileChange}
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleProfileChange}
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleProfileChange}
                      placeholder="+1-555-0000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Bio</label>
                    <input
                      type="text"
                      name="bio"
                      value={formData.bio}
                      onChange={handleProfileChange}
                      placeholder="Brief bio"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Address</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleProfileChange}
                      placeholder="Street address"
                    />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleProfileChange}
                      placeholder="City"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>State/Province</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleProfileChange}
                      placeholder="State"
                    />
                  </div>
                  <div className="form-group">
                    <label>Country</label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleProfileChange}
                      placeholder="Country"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Postal Code</label>
                  <input
                    type="text"
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={handleProfileChange}
                    placeholder="Postal Code"
                  />
                </div>

                <button type="submit" className="btn btn-primary">
                  Save Profile Changes
                </button>
              </form>
            </div>
          </div>

          {/* Role-Specific Section */}
          {getRoleSpecificSection()}
        </div>
      )}

      {/* SECURITY TAB */}
      {activeTab === 'security' && (
        <div className="security-content">
          <div className="card">
            <h3>Security Status</h3>
            <div className="security-grid">
              <div className="security-item">
                <Shield size={24} />
                <div>
                  <p className="security-label">Password Strength</p>
                  <p className="security-value">{securitySummary?.password_strength}</p>
                </div>
              </div>
              <div className="security-item">
                <Lock size={24} />
                <div>
                  <p className="security-label">Two-Factor Authentication</p>
                  <p className="security-value">
                    Not configured
                  </p>
                </div>
              </div>
              <div className="security-item">
                <LogIn size={24} />
                <div>
                  <p className="security-label">Active Sessions</p>
                  <p className="security-value">{securitySummary?.active_sessions}</p>
                </div>
              </div>
              <div className="security-item">
                <Shield size={24} />
                <div>
                  <p className="security-label">Account Status</p>
                  <p className="security-value">{securitySummary?.account_status}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Change Password</h3>
            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value
                    })
                  }
                  placeholder="Enter current password"
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value
                    })
                  }
                  placeholder="Enter new password"
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value
                    })
                  }
                  placeholder="Confirm new password"
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Update Password
              </button>
            </form>
          </div>

        </div>
      )}

      {/* NOTIFICATIONS TAB */}
      {activeTab === 'notifications' && (
        <div className="notifications-content">
          <div className="card">
            <h3>Notification Preferences</h3>
            <div className="notification-settings">
              <div className="setting-item">
                <div>
                  <p className="setting-label">Email Notifications</p>
                  <p className="setting-description">Receive notifications via email</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(Number(preferences?.email_notifications))}
                  onChange={(e) => handlePreferenceChange('email_notifications', e.target.checked)}
                />
              </div>
              <div className="setting-item">
                <div>
                  <p className="setting-label">Push Notifications</p>
                  <p className="setting-description">Receive browser push notifications</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(Number(preferences?.system_notifications))}
                  onChange={(e) => handlePreferenceChange('system_notifications', e.target.checked)}
                />
              </div>
              <div className="setting-item">
                <div>
                  <p className="setting-label">Weekly Reports</p>
                  <p className="setting-description">Receive weekly summary reports</p>
                </div>
                <input type="checkbox" checked={Boolean(Number(preferences?.weekly_reports))} onChange={(e) => handlePreferenceChange('weekly_reports', e.target.checked)} />
              </div>
              <div className="setting-item">
                <div>
                  <p className="setting-label">Maintenance Alerts</p>
                  <p className="setting-description">Get alerts for maintenance due items</p>
                </div>
                <input type="checkbox" checked={Boolean(Number(preferences?.item_updates))} onChange={(e) => handlePreferenceChange('item_updates', e.target.checked)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVITY TAB */}
      {activeTab === 'activity' && (
        <div className="activity-content">
          <div className="card">
            <h3>Recent Login History</h3>
            <div className="activity-list">
              {loginHistory && loginHistory.length > 0 ? (
                loginHistory.slice(0, 5).map((login) => (
                  <div key={login.id} className="activity-item">
                    <LogIn size={20} />
                    <div>
                      <p className="activity-title">{login.device}</p>
                      <p className="activity-description">
                        {login.location} ({login.ip_address})
                      </p>
                      <p className="activity-time">
                        {new Date(login.login_time).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-data">No login history available</p>
              )}
            </div>
          </div>

          <div className="card">
            <h3>Account Activity Log</h3>
            <div className="activity-list">
              {activityLog && activityLog.length > 0 ? (
                activityLog.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="activity-item">
                    <Activity size={20} />
                    <div>
                      <p className="activity-title">{activity.action}</p>
                      <p className="activity-description">{activity.resource}</p>
                      <p className="activity-time">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span className={`status-badge ${activity.status.toLowerCase()}`}>
                      {activity.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="no-data">No activity log available</p>
              )}
            </div>
          </div>

          <div className="card">
            <h3>Data Management</h3>
            <div className="data-management">
              <p>Download a copy of your profile data including all personal information and activity logs.</p>
              <button className="btn btn-secondary" onClick={handleExportData}>
                <Download size={18} /> Export My Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
