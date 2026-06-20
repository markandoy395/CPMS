// Profile Service
import { MOCK_USERS } from './mockData.js'

let MOCK_PROFILE_PREFERENCES = [
  {
    user_id: '1',
    theme: 'light',
    notifications_email: true,
    notifications_push: true,
    language: 'en',
    two_factor_enabled: false,
    session_timeout: 30
  },
  {
    user_id: '2',
    theme: 'dark',
    notifications_email: true,
    notifications_push: false,
    language: 'en',
    two_factor_enabled: true,
    session_timeout: 60
  }
]

let MOCK_LOGIN_HISTORY = [
  {
    id: '1',
    user_id: '2',
    login_time: '2025-03-05T08:30:00Z',
    ip_address: '192.168.1.100',
    device: 'Windows Chrome',
    location: 'New York, USA'
  },
  {
    id: '2',
    user_id: '2',
    login_time: '2025-03-04T10:15:00Z',
    ip_address: '192.168.1.100',
    device: 'Windows Chrome',
    location: 'New York, USA'
  }
]

let MOCK_ACTIVITY_LOG = [
  {
    id: '1',
    user_id: '2',
    action: 'Updated Profile',
    resource: 'Profile',
    timestamp: '2025-03-01T14:30:00Z',
    status: 'Success'
  }
]

export const profileService = {
  /**
   * Get complete user profile
   */
  async getProfile(userId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200))
      const user = MOCK_USERS.find(u => u.id === userId)
      if (!user) {
        return { success: false, message: 'User not found' }
      }

      const userData = { ...user }
      delete userData.password

      return { success: true, data: userData }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Get complete profile with all details
   */
  async getFullProfile(userId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const user = MOCK_USERS.find(u => u.id === userId)
      if (!user) {
        return { success: false, message: 'User not found' }
      }

      const preferences = MOCK_PROFILE_PREFERENCES.find(p => p.user_id === userId)
      const loginHistory = MOCK_LOGIN_HISTORY.filter(l => l.user_id === userId)
      const activityLog = MOCK_ACTIVITY_LOG.filter(a => a.user_id === userId)

      const userData = { ...user }
      delete userData.password

      return {
        success: true,
        data: {
          profile: userData,
          preferences: preferences || this._getDefaultPreferences(userId),
          loginHistory,
          activityLog,
          stats: {
            lastLogin: loginHistory[0]?.login_time || null,
            totalLogins: loginHistory.length,
            recentActivities: activityLog.length
          }
        }
      }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Update user profile information
   */
  async updateProfileInfo(userId, profileData) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const user = MOCK_USERS.find(u => u.id === userId)
      if (!user) {
        return { success: false, message: 'User not found' }
      }

      // Only allow certain fields to be updated
      const allowedFields = ['name', 'email', 'phone', 'address', 'city', 'state', 'country', 'postal_code', 'bio', 'avatar_url']
      
      allowedFields.forEach(field => {
        if (profileData[field] !== undefined) {
          user[field] = profileData[field]
        }
      })

      // Log activity
      this._logActivity(userId, `Updated Profile Information`, 'Profile', 'Success')

      const userData = { ...user }
      delete userData.password

      return { success: true, data: userData }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Update user preferences
   */
  async updatePreferences(userId, preferences) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      let userPrefs = MOCK_PROFILE_PREFERENCES.find(p => p.user_id === userId)

      if (!userPrefs) {
        userPrefs = { user_id: userId, ...this._getDefaultPreferences(userId) }
        MOCK_PROFILE_PREFERENCES.push(userPrefs)
      }

      Object.assign(userPrefs, preferences)

      this._logActivity(userId, `Updated Preferences`, 'Settings', 'Success')

      return { success: true, data: userPrefs }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Get user preferences
   */
  async getPreferences(userId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200))
      const prefs = MOCK_PROFILE_PREFERENCES.find(p => p.user_id === userId)
      return {
        success: true,
        data: prefs || this._getDefaultPreferences(userId)
      }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Update password
   */
  async updatePassword(userId, currentPassword, newPassword) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const user = MOCK_USERS.find(u => u.id === userId)
      if (!user) {
        return { success: false, message: 'User not found' }
      }

      if (user.password !== currentPassword) {
        return { success: false, message: 'Current password is incorrect' }
      }

      user.password = newPassword

      this._logActivity(userId, `Changed Password`, 'Security', 'Success')

      return { success: true, message: 'Password updated successfully' }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Enable/Disable two-factor authentication
   */
  async toggleTwoFactor(userId, enable) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      let prefs = MOCK_PROFILE_PREFERENCES.find(p => p.user_id === userId)

      if (!prefs) {
        prefs = { user_id: userId, ...this._getDefaultPreferences(userId) }
        MOCK_PROFILE_PREFERENCES.push(prefs)
      }

      prefs.two_factor_enabled = enable

      this._logActivity(
        userId,
        `${enable ? 'Enabled' : 'Disabled'} Two-Factor Authentication`,
        'Security',
        'Success'
      )

      return {
        success: true,
        message: `Two-factor authentication ${enable ? 'enabled' : 'disabled'}`,
        data: prefs
      }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Get login history
   */
  async getLoginHistory(userId, limit = 10) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200))
      const history = MOCK_LOGIN_HISTORY.filter(l => l.user_id === userId)
        .sort((a, b) => new Date(b.login_time) - new Date(a.login_time))
        .slice(0, limit)

      return { success: true, data: history }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Log a new login
   */
  async logLogin(userId, loginData) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200))
      const login = {
        id: `login_${Date.now()}`,
        user_id: userId,
        login_time: new Date().toISOString(),
        ip_address: loginData.ip_address || '0.0.0.0',
        device: loginData.device || 'Unknown',
        location: loginData.location || 'Unknown'
      }

      MOCK_LOGIN_HISTORY.push(login)

      return { success: true, data: login }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Get activity log
   */
  async getActivityLog(userId, limit = 20) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200))
      const activities = MOCK_ACTIVITY_LOG.filter(a => a.user_id === userId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit)

      return { success: true, data: activities }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Get notification preferences
   */
  async getNotificationSettings(userId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200))
      const prefs = MOCK_PROFILE_PREFERENCES.find(p => p.user_id === userId) ||
        this._getDefaultPreferences(userId)

      return {
        success: true,
        data: {
          email_notifications: prefs.notifications_email,
          push_notifications: prefs.notifications_push,
          notification_types: {
            maintenance_alerts: true,
            inventory_alerts: true,
            approval_requests: true,
            system_updates: true,
            weekly_reports: false
          }
        }
      }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Update notification settings
   */
  async updateNotificationSettings(userId, settings) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      let prefs = MOCK_PROFILE_PREFERENCES.find(p => p.user_id === userId)

      if (!prefs) {
        prefs = { user_id: userId, ...this._getDefaultPreferences(userId) }
        MOCK_PROFILE_PREFERENCES.push(prefs)
      }

      prefs.notifications_email = settings.email_notifications ?? prefs.notifications_email
      prefs.notifications_push = settings.push_notifications ?? prefs.notifications_push

      this._logActivity(userId, `Updated Notification Settings`, 'Settings', 'Success')

      return { success: true, data: prefs }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Get account security summary
   */
  async getSecuritySummary(userId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const prefs = MOCK_PROFILE_PREFERENCES.find(p => p.user_id === userId)
      const loginHistory = MOCK_LOGIN_HISTORY.filter(l => l.user_id === userId)

      return {
        success: true,
        data: {
          password_strength: 'Strong',
          two_factor_enabled: prefs?.two_factor_enabled || false,
          active_sessions: loginHistory.length,
          last_login: loginHistory[0]?.login_time || null,
          last_password_change: '2024-12-15T10:00:00Z',
          account_status: 'Secure'
        }
      }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Deactivate account
   */
  async deactivateAccount(userId, reason = '') {
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      const user = MOCK_USERS.find(u => u.id === userId)
      if (!user) {
        return { success: false, message: 'User not found' }
      }

      user.status = 'Inactive'

      this._logActivity(userId, `Deactivated Account`, 'Account', 'Success')

      return { success: true, message: 'Account deactivated successfully' }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Get role-specific statistics
   */
  async getRoleStats(userId, role) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))

      switch (role) {
        case 'Custodian':
          return {
            success: true,
            data: {
              department: 'IT Department',
              total_items: 12,
              items_good_condition: 10,
              items_fair_condition: 2,
              items_poor_condition: 0,
              pending_maintenance: 2,
              warranty_expiring_soon: 3,
              last_verification: new Date().toISOString()
            }
          }

        case 'Admin':
          return {
            success: true,
            data: {
              users_managed: 15,
              active_users: 14,
              inactive_users: 1,
              total_assets: 250,
              departments: 8,
              audits_conducted: 12,
              last_security_check: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              system_health: 'Excellent'
            }
          }

        case 'Auditor':
          return {
            success: true,
            data: {
              audit_scope: 'Multi-Department',
              audits_completed: 24,
              current_audits: 3,
              compliance_rate: 95,
              average_audit_time: '15 days',
              total_items_audited: 350,
              critical_findings: 2,
              minor_findings: 8
            }
          }

        default:
          return {
            success: true,
            data: {}
          }
      }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Export profile data
   */
  async exportProfileData(userId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      const profile = await this.getFullProfile(userId)
      if (!profile.success) {
        return profile
      }

      const exportData = {
        export_date: new Date().toISOString(),
        profile: profile.data.profile,
        preferences: profile.data.preferences,
        loginHistory: profile.data.loginHistory,
        activityLog: profile.data.activityLog
      }

      this._logActivity(userId, `Exported Profile Data`, 'Data', 'Success')

      return {
        success: true,
        data: exportData,
        format: 'application/json'
      }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  // Helper methods
  _getDefaultPreferences(userId) {
    return {
      user_id: userId,
      theme: 'light',
      notifications_email: true,
      notifications_push: false,
      language: 'en',
      two_factor_enabled: false,
      session_timeout: 30
    }
  },

  _logActivity(userId, action, resource, status) {
    const activity = {
      id: `activity_${Date.now()}`,
      user_id: userId,
      action,
      resource,
      timestamp: new Date().toISOString(),
      status
    }
    MOCK_ACTIVITY_LOG.push(activity)
  }
}
