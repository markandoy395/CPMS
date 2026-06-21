import { apiRequest } from './apiClient'

export const userService = {
  getAllUsers() {
    return apiRequest('/users')
  },
  createUser(data) {
    return apiRequest('/users', { method: 'POST', body: data })
  },
  updateUser(id, data) {
    return apiRequest(`/users/${id}`, { method: 'PUT', body: data })
  },
  deactivateUser(id) {
    return apiRequest(`/users/${id}`, { method: 'DELETE' })
  },
  getAuditLogs() {
    return apiRequest('/audit-logs')
  }
}
