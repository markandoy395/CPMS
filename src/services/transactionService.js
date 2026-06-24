import { apiRequest } from './apiClient'

export const transactionService = {
  getAllTransactions(filters = {}) {
    return apiRequest('/transactions', { query: filters })
  },
  createTransaction(data) {
    return apiRequest('/transactions', { method: 'POST', body: data })
  },
  updateTransaction() {
    return Promise.resolve({ success: false, message: 'Transactions are immutable. Create a correcting transaction.' })
  },
  deleteTransaction() {
    return Promise.resolve({ success: false, message: 'Transactions are retained for audit history.' })
  },
  getTransactionStats() {
    return apiRequest('/transactions/stats')
  },
  getBorrowings(filters = {}) {
    return apiRequest('/borrowings', { query: filters })
  },
  getBorrowRequests(filters = {}) {
    return apiRequest('/borrow-requests', { query: filters })
  },
  createBorrowRequest(data) {
    return apiRequest('/borrow-requests', { method: 'POST', body: data })
  },
  approveBorrowRequest(id, data = {}) {
    return apiRequest(`/borrow-requests/${id}/approve`, { method: 'PUT', body: data })
  },
  markBorrowRequestPickedUp(id) {
    return apiRequest(`/borrow-requests/${id}/pickup`, { method: 'PUT' })
  },
  rejectBorrowRequest(id, data = {}) {
    return apiRequest(`/borrow-requests/${id}/reject`, { method: 'PUT', body: data })
  },
  cancelBorrowRequest(id, data = {}) {
    return apiRequest(`/borrow-requests/${id}/cancel`, { method: 'PUT', body: data })
  },
  createBorrowing(data) {
    return apiRequest('/borrowings', { method: 'POST', body: data })
  },
  returnBorrowing(id, data) {
    return apiRequest(`/borrowings/${id}/return`, { method: 'PUT', body: data })
  }
}
