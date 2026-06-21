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
  }
}
