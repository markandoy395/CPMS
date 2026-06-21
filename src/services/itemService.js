import { apiRequest } from './apiClient'

export const itemService = {
  getAllItems(filters = {}) {
    return apiRequest('/items', { query: filters })
  },
  getItemById(id) {
    return apiRequest(`/items/${id}`)
  },
  createItem(data) {
    return apiRequest('/items', { method: 'POST', body: data })
  },
  updateItem(id, data) {
    return apiRequest(`/items/${id}`, { method: 'PUT', body: data })
  },
  deleteItem(id) {
    return apiRequest(`/items/${id}`, { method: 'DELETE' })
  },
  getItemStats() {
    return apiRequest('/items/stats')
  }
}
