import React, { useState, useEffect } from 'react'
import { Plus, Search } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorAlert } from '../components/ErrorAlert'
import { SuccessAlert } from '../components/SuccessAlert'
import { transactionService } from '../services/transactionService'
import { itemService } from '../services/itemService'
import { custodianService } from '../services/custodianService'
import { useAuth } from '../context/AuthContext'
import { FormOverlay } from '../components/FormOverlay'

export default function TransactionsPage() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [items, setItems] = useState([])
  const [custodians, setCustodians] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    item_id: '',
    custodian_id: '',
    transaction_type: 'Issuance',
    notes: '',
    par_id: '',
    ics_id: ''
  })

  useEffect(() => {
    loadTransactions()
    Promise.all([itemService.getAllItems(), custodianService.getAllCustodians()]).then(([itemsResult, custodiansResult]) => {
      if (itemsResult.success) setItems(itemsResult.data)
      if (custodiansResult.success) setCustodians(custodiansResult.data)
    })
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
      const result = await transactionService.createTransaction(formData)

      if (result.success) {
        setSuccess('Transaction recorded and inventory updated successfully')
        setShowForm(false)
        setFormData({
          item_id: '',
          custodian_id: '',
          transaction_type: 'Issuance',
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
        {user?.role === 'Admin' && <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={18} /> Record Transaction
        </button>}
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

      {showForm && (
        <FormOverlay
          title="Record New Transaction"
          description="Issue, transfer, return, or dispose of an inventory item."
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Item</label>
                <select
                  value={formData.item_id}
                  onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                  required
                >
                  <option value="">Select item</option>
                  {items.map(item => <option key={item.id} value={item.id}>{item.item_code} - {item.item_name} ({item.status})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Receiving Custodian</label>
                <select
                  value={formData.custodian_id}
                  onChange={(e) => setFormData({ ...formData, custodian_id: e.target.value })}
                  required={['Issuance', 'Transfer'].includes(formData.transaction_type)}
                >
                  <option value="">None</option>
                  {custodians.filter(c => c.status === 'Active').map(c => <option key={c.id} value={c.id}>{c.users?.name} - {c.department}</option>)}
                </select>
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
                {loading ? 'Saving...' : 'Record Transaction'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </FormOverlay>
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
                    <td>{transaction.custodians?.users?.name || 'N/A'}</td>
                    <td>{transaction.issuer?.name || 'N/A'}</td>
                    <td>{transaction.par_id || '-'}</td>
                    <td>{transaction.ics_id || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center">No transactions found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
