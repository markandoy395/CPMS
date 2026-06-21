import { apiRequest } from './apiClient'

export const profileService = {
  async getFullProfile() {
    const result = await apiRequest('/profile')
    if (!result.success) return result
    result.data.loginHistory = result.data.loginHistory.map((entry, index) => ({
      id: `login-${index}-${entry.created_at}`,
      device: 'Web browser',
      location: 'Local CPMS',
      ip_address: entry.ip_address,
      login_time: entry.created_at
    }))
    result.data.activityLog = result.data.activityLog.map((entry, index) => ({
      id: `activity-${index}-${entry.created_at}`,
      action: entry.action.replaceAll('_', ' '),
      resource: `${entry.entity_type}${entry.entity_id ? ` #${entry.entity_id}` : ''}`,
      timestamp: entry.created_at,
      status: 'Completed'
    }))
    return result
  },
  async getSecuritySummary() {
    const result = await apiRequest('/profile')
    return result.success ? { success: true, data: result.data.security } : result
  },
  async getRoleStats(_userId, role) {
    const result = await apiRequest('/reports')
    if (!result.success) return result
    const reports = result.data
    const data = ['Super Admin', 'Admin'].includes(role)
      ? { users_managed: 0, audits_conducted: reports.transactions.totalTransactions, last_security_check: reports.generated_at }
      : role === 'Auditor'
        ? { audit_scope: 'All Departments', audits_completed: reports.transactions.totalTransactions, current_audits: reports.maintenance.pending, compliance_rate: 100 }
        : { department: 'Assigned Department', total_items: reports.items.totalItems, items_good_condition: reports.items.activeCount, pending_maintenance: reports.maintenance.pending }
    return { success: true, data }
  },
  async updateProfileInfo(userId, data) {
    const result = await apiRequest('/auth/profile', { method: 'PUT', body: data })
    return result.success ? { success: true, data: result.user } : result
  },
  updatePassword(_userId, currentPassword, newPassword) {
    return apiRequest('/auth/password', { method: 'POST', body: { current_password: currentPassword, new_password: newPassword } })
  },
  async exportProfileData() {
    const result = await apiRequest('/profile')
    return result.success ? { success: true, data: result.data } : result
  },
  getPreferences() {
    return apiRequest('/preferences')
  },
  updatePreferences(preferences) {
    return apiRequest('/preferences', { method: 'PUT', body: preferences })
  }
}
