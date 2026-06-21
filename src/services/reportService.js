import { apiRequest } from './apiClient'

export const reportService = {
  getSummary(options = {}) {
    return apiRequest('/reports', { query: options })
  }
}
