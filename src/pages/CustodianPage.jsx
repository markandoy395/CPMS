import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Search } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorAlert } from '../components/ErrorAlert'
import { SuccessAlert } from '../components/SuccessAlert'
import { custodianService } from '../services/custodianService'
import { useAuth } from '../context/AuthContext'
import { FormOverlay } from '../components/FormOverlay'

export default function CustodianPage() {
  const { user } = useAuth()
  const canManage = ['Super Admin', 'Admin'].includes(user?.role)
  const [custodians, setCustodians] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    user_id: '',
    department: '',
    position: '',
    contact_number: '',
    status: 'Active'
  })

  useEffect(() => {
    loadCustodians()
  }, [])

  const loadCustodians = async () => {
    try {
      setError('')
      const result = await custodianService.getAllCustodians()
      if (result.success) {
        setCustodians(result.data)
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
    const result = await custodianService.getAllCustodians({
      search: searchTerm,
      status: statusFilter
    })
    if (result.success) {
      setCustodians(result.data)
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
        result = await custodianService.updateCustodian(editingId, formData)
      } else {
        result = await custodianService.createCustodian(formData)
      }

      if (result.success) {
        setSuccess(editingId ? 'Custodian updated successfully' : 'Custodian created successfully')
        setShowForm(false)
        setEditingId(null)
        setFormData({
          user_id: '',
          department: '',
          position: '',
          contact_number: '',
          status: 'Active'
        })
        loadCustodians()
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
    if (!window.confirm('Are you sure you want to delete this custodian?')) return

    setLoading(true)
    const result = await custodianService.deleteCustodian(id)
    if (result.success) {
      setSuccess('Custodian deleted successfully')
      loadCustodians()
    } else {
      setError(result.message)
    }
    setLoading(false)
  }

  const handleEdit = (custodian) => {
    setFormData({
      user_id: custodian.user_id,
      department: custodian.department,
      position: custodian.position || '',
      contact_number: custodian.contact_number || '',
      status: custodian.status
    })
    setEditingId(custodian.id)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
  }

  const filteredCustodians = custodians.filter(custodian => {
    const matchesSearch = (custodian.users?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !statusFilter || custodian.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading && !custodians.length) return <LoadingSpinner message="Loading custodians..." />

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Custodian Management</h1>
        {canManage && <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={18} /> Add Custodian
        </button>}
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

      {showForm && (
        <FormOverlay
          title={editingId ? 'Edit Custodian' : 'Add New Custodian'}
          description="Maintain the custodian's assignment and contact information."
          onClose={closeForm}
        >
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>User ID</label>
                <input
                  type="text"
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  placeholder="User ID"
                  required
                />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g., Admin, Finance"
                  required
                />
              </div>
              <div className="form-group">
                <label>Position</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="e.g., Manager"
                />
              </div>
              <div className="form-group">
                <label>Contact Number</label>
                <input
                  type="tel"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                  placeholder="e.g., +1234567890"
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : editingId ? 'Update Custodian' : 'Create Custodian'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeForm}
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
                placeholder="Search custodians..."
              />
            </div>
            <div className="form-group">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </form>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Position</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustodians.length > 0 ? (
                filteredCustodians.map(custodian => (
                  <tr key={custodian.id}>
                    <td>{custodian.users?.name || 'N/A'}</td>
                    <td>{custodian.users?.email || 'N/A'}</td>
                    <td>{custodian.department}</td>
                    <td>{custodian.position || 'N/A'}</td>
                    <td>{custodian.contact_number || 'N/A'}</td>
                    <td>
                      <span className={`status-badge status-${custodian.status.toLowerCase()}`}>
                        {custodian.status}
                      </span>
                    </td>
                    <td className="action-buttons">
                      {canManage && <>
                      <button
                        className="btn-icon btn-edit"
                        onClick={() => handleEdit(custodian)}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(custodian.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                      </>}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center">No custodians found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
