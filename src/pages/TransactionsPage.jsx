import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Search } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorAlert } from '../components/ErrorAlert'
import { SuccessAlert } from '../components/SuccessAlert'
import { transactionService } from '../services/transactionService'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    item_id: '',
    custodian_id: '',
    transaction_type: 'Issuance',
    issued_by: '',
    notes: '',
    par_id: '',
    ics_id: ''
  })

  useEffect(() => {
    loadTransactions()
  }, [])

  const loadTransactions = async () => {
    try {
      setError('')
      const result = await transactionService.getAllTransactions()
      if (result.success) {
        setTransactions(result.data)
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    setLoading(true)
    const result = await transactionService.getAllTransactions({
      type: typeFilter
    })
    if (result.success) {
      setTransactions(result.data)
    }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let result
      if (editingId) {
        result = await transactionService.updateTransaction(editingId, formData)
      } else {
        result = await transactionService.createTransaction(formData)
      }

      if (result.success) {
        setSuccess(editingId ? 'Transaction updated successfully' : 'Transaction created successfully')
        setShowForm(false)
        setEditingId(null)
        setFormData({
          item_id: '',
          custodian_id: '',
          transaction_type: 'Issuance',
          issued_by: '',
          notes: '',
          par_id: '',
          ics_id: ''
        })
        loadTransactions()
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return

    setLoading(true)
    const result = await transactionService.deleteTransaction(id)
    if (result.success) {
      setSuccess('Transaction deleted successfully')
      loadTransactions()
    } else {
      setError(result.message)
    }
    setLoading(false)
  }

  const handleEdit = (transaction) => {
    setFormData({
      item_id: transaction.item_id,
      custodian_id: transaction.custodian_id,
      transaction_type: transaction.transaction_type,
      issued_by: transaction.issued_by,
      notes: transaction.notes || '',
      par_id: transaction.par_id || '',
      ics_id: transaction.ics_id || ''
    })
    setEditingId(transaction.id)
    setShowForm(true)
  }

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = (transaction.items?.item_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = !typeFilter || transaction.transaction_type === typeFilter
    return matchesSearch && matchesType
  })

  if (loading && !transactions.length) return <LoadingSpinner message="Loading transactions..." />

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Transactions</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={18} /> Record Transaction
        </button>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

      {showForm && (
        <div className="card form-card">
          <h3>{editingId ? 'Edit Transaction' : 'Record New Transaction'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Item ID</label>
                <input
                  type="text"
                  value={formData.item_id}
                  onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                  placeholder="Item ID"
                  required
                />
              </div>
              <div className="form-group">
                <label>Custodian ID</label>
                <input
                  type="text"
                  value={formData.custodian_id}
                  onChange={(e) => setFormData({ ...formData, custodian_id: e.target.value })}
                  placeholder="Custodian ID"
                />
              </div>
              <div className="form-group">
                <label>Transaction Type</label>
                <select
                  value={formData.transaction_type}
                  onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                >
                  <option value="Issuance">Issuance</option>
                  <option value="Transfer">Transfer</option>
                  <option value="Return">Return</option>
                  <option value="Disposal">Disposal</option>
                </select>
              </div>
              <div className="form-group">
                <label>Issued By (User ID)</label>
                <input
                  type="text"
                  value={formData.issued_by}
                  onChange={(e) => setFormData({ ...formData, issued_by: e.target.value })}
                  placeholder="Issuing Officer"
                  required
                />
              </div>
              <div className="form-group">
                <label>PAR ID</label>
                <input
                  type="text"
                  value={formData.par_id}
                  onChange={(e) => setFormData({ ...formData, par_id: e.target.value })}
                  placeholder="Property Acknowledgment Receipt"
                />
              </div>
              <div className="form-group">
                <label>ICS ID</label>
                <input
                  type="text"
                  value={formData.ics_id}
                  onChange={(e) => setFormData({ ...formData, ics_id: e.target.value })}
                  placeholder="Inventory Custodian Slip"
                />
              </div>
              <div className="form-group full-width">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Transaction notes..."
                  rows="3"
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : editingId ? 'Update Transaction' : 'Record Transaction'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-inputs">
            <div className="form-group search-group">
              <Search size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search transactions..."
              />
            </div>
            <div className="form-group">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="Issuance">Issuance</option>
                <option value="Transfer">Transfer</option>
                <option value="Return">Return</option>
                <option value="Disposal">Disposal</option>
              </select>
            </div>
          </div>
        </form>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Type</th>
                <th>Custodian</th>
                <th>Issued By</th>
                <th>PAR ID</th>
                <th>ICS ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map(transaction => (
                  <tr key={transaction.id}>
                    <td>{new Date(transaction.transaction_date).toLocaleDateString()}</td>
                    <td>{transaction.items?.item_name || 'N/A'}</td>
                    <td>
                      <span className={`status-badge status-${transaction.transaction_type.toLowerCase()}`}>
                        {transaction.transaction_type}
                      </span>
                    </td>
                    <td>{transaction.custodians?.department || 'N/A'}</td>
                    <td>{transaction.users?.name || 'N/A'}</td>
                    <td>{transaction.par_id || '-'}</td>
                    <td>{transaction.ics_id || '-'}</td>
                    <td className="action-buttons">
                      <button
                        className="btn-icon btn-edit"
                        onClick={() => handleEdit(transaction)}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(transaction.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center">No transactions found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
