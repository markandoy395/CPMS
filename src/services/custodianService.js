import { apiRequest } from './apiClient'

export const custodianService = {
  getAllCustodians(filters = {}) {
    return apiRequest('/custodians', { query: filters })
  },
  getCustodianById(id) {
    return apiRequest(`/custodians/${id}`)
  },
  createCustodian(data) {
    return apiRequest('/custodians', { method: 'POST', body: data })
  },
  updateCustodian(id, data) {
    return apiRequest(`/custodians/${id}`, { method: 'PUT', body: data })
  },
  deleteCustodian(id) {
    return apiRequest(`/custodians/${id}`, { method: 'DELETE' })
  },
  getCustodianStats() {
    return apiRequest('/custodians/stats')
  },
  getMaintenanceRecords() {
    return apiRequest('/maintenance')
  },
  scheduleMaintenance(_custodianId, itemId, data) {
    return apiRequest('/maintenance', { method: 'POST', body: { ...data, item_id: itemId } })
  },
  updateMaintenanceStatus(id, status) {
    return apiRequest(`/maintenance/${id}`, { method: 'PUT', body: { status } })
  },
  getVerificationHistory() {
    return apiRequest('/verifications')
  },
  performInventoryVerification(custodianId, data) {
    return apiRequest('/verifications', { method: 'POST', body: { ...data, custodian_id: custodianId } })
  },
  getTransferHistory() {
    return apiRequest('/transactions', { query: { type: 'Transfer' } })
  },
  getCustodianAlerts() {
    return apiRequest('/maintenance', { query: { status: 'Pending' } })
  }
}
