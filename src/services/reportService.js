import { apiRequest } from './apiClient'

export const reportService = {
  getSummary() {
    return apiRequest('/reports')
  }
}
