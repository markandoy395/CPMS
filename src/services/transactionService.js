// Mock Transaction Service (Supabase Disabled)

let MOCK_TRANSACTIONS = [
  {
    id: '1',
    transaction_type: 'Issuance',
    item_id: '1',
    custodian_id: '2',
    par_id: 'PAR-001',
    ics_id: 'ICS-001',
    notes: 'Initial issuance of desktop',
    transaction_date: '2024-01-15T10:00:00Z',
    created_by: '1',
    items: { id: '1', item_name: 'Desktop Computer' },
    custodians: { id: '2', department: 'IT' },
    users: { id: '1', name: 'Admin User' }
  },
  {
    id: '2',
    transaction_type: 'Transfer',
    item_id: '3',
    custodian_id: '3',
    par_id: null,
    ics_id: null,
    notes: 'Transfer to Finance department',
    transaction_date: '2024-01-17T14:00:00Z',
    created_by: '1',
    items: { id: '3', item_name: 'Monitor' },
    custodians: { id: '3', department: 'Finance' },
    users: { id: '1', name: 'Admin User' }
  }
]

export const transactionService = {
  async getAllTransactions(filters = {}) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      
      let data = [...MOCK_TRANSACTIONS]
      
      if (filters.type) {
        data = data.filter(t => t.transaction_type === filters.type)
      }
      if (filters.custodian_id) {
        data = data.filter(t => t.custodian_id === filters.custodian_id)
      }
      if (filters.item_id) {
        data = data.filter(t => t.item_id === filters.item_id)
      }
      
      return { success: true, data: data.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)) }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async getTransactionById(id) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200))
      const data = MOCK_TRANSACTIONS.find(t => t.id === id)
      return data ? { success: true, data } : { success: false, message: 'Transaction not found' }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async createTransaction(transactionData) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const newTransaction = {
        id: Date.now().toString(),
        ...transactionData,
        transaction_date: new Date().toISOString()
      }
      MOCK_TRANSACTIONS.push(newTransaction)
      return { success: true, data: newTransaction }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async updateTransaction(id, transactionData) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const index = MOCK_TRANSACTIONS.findIndex(t => t.id === id)
      if (index === -1) {
        return { success: false, message: 'Transaction not found' }
      }
      MOCK_TRANSACTIONS[index] = { ...MOCK_TRANSACTIONS[index], ...transactionData }
      return { success: true, data: MOCK_TRANSACTIONS[index] }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async deleteTransaction(id) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const index = MOCK_TRANSACTIONS.findIndex(t => t.id === id)
      if (index === -1) {
        return { success: false, message: 'Transaction not found' }
      }
      MOCK_TRANSACTIONS.splice(index, 1)
      return { success: true }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async getTransactionStats() {
    try {
      await new Promise(resolve => setTimeout(resolve, 200))
      const totalTransactions = MOCK_TRANSACTIONS.length
      
      return {
        success: true,
        stats: {
          totalTransactions,
          issuances: MOCK_TRANSACTIONS.filter(t => t.transaction_type === 'Issuance').length,
          transfers: MOCK_TRANSACTIONS.filter(t => t.transaction_type === 'Transfer').length,
          returns: MOCK_TRANSACTIONS.filter(t => t.transaction_type === 'Return').length,
          disposals: MOCK_TRANSACTIONS.filter(t => t.transaction_type === 'Disposal').length
        }
      }
    } catch (error) {
      return { success: false, message: error.message }
    }
  }
}
