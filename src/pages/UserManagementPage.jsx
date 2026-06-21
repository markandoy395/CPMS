import React, { useEffect, useState } from 'react'
import { Edit, Plus, Search, UserX } from 'lucide-react'
import { ErrorAlert } from '../components/ErrorAlert'
import { SuccessAlert } from '../components/SuccessAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { userService } from '../services/userService'
import { FormOverlay } from '../components/FormOverlay'
import { useAuth } from '../context/AuthContext'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'Custodian',
  status: 'Active',
  department: ''
}

export default function UserManagementPage() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'Super Admin'
  const [users, setUsers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [formData, setFormData] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = async () => {
    setLoading(true)
    const [usersResult, logsResult] = await Promise.all([
      userService.getAllUsers(),
      userService.getAuditLogs()
    ])
    if (usersResult.success) setUsers(usersResult.data)
    else setError(usersResult.message)
    if (logsResult.success) setAuditLogs(logsResult.data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const result = editingId
      ? await userService.updateUser(editingId, formData)
      : await userService.createUser(formData)

    if (!result.success) {
      setError(result.message)
      return
    }

    setSuccess(editingId ? 'User updated successfully.' : 'User created successfully.')
    setFormData(emptyForm)
    setEditingId(null)
    setShowForm(false)
    loadData()
  }

  const handleEdit = (user) => {
    setEditingId(user.id)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
      department: ''
    })
    setShowForm(true)
  }

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this user account?')) return
    const result = await userService.deactivateUser(id)
    if (result.success) {
      setSuccess('User deactivated successfully.')
      loadData()
    } else {
      setError(result.message)
    }
  }

  const visibleUsers = users.filter(user => {
    const value = `${user.name} ${user.email} ${user.role}`.toLowerCase()
    return value.includes(search.toLowerCase())
  })

  if (loading && users.length === 0) return <LoadingSpinner message="Loading users..." />

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <p>Manage access, roles, and account status.</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
                    setEditingId(null)
                    setFormData(emptyForm)
                    setShowForm(current => !current)
                  }}>
          <Plus size={18} /> Add User
        </button>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

      {showForm && (
        <FormOverlay
          title={editingId ? 'Edit User' : 'Create User'}
          description="Set account access, role, and status."
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Name</label>
                <input required value={formData.name} onChange={event => setFormData({ ...formData, name: event.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input required type="email" value={formData.email} onChange={event => setFormData({ ...formData, email: event.target.value })} />
              </div>
              <div className="form-group">
                <label>{editingId ? 'New Password (optional)' : 'Password'}</label>
                <input required={!editingId} type="password" minLength="8" value={formData.password} onChange={event => setFormData({ ...formData, password: event.target.value })} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={formData.role} onChange={event => setFormData({ ...formData, role: event.target.value })}>
                  {isSuperAdmin && <option>Super Admin</option>}
                  <option>Custodian</option>
                  <option>Auditor</option>
                  <option>Admin</option>
                </select>
              </div>
              {!editingId && formData.role === 'Custodian' && (
                <div className="form-group">
                  <label>Department</label>
                  <input value={formData.department} onChange={event => setFormData({ ...formData, department: event.target.value })} />
                </div>
              )}
              <div className="form-group">
                <label>Status</label>
                <select value={formData.status} onChange={event => setFormData({ ...formData, status: event.target.value })}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit">{editingId ? 'Update User' : 'Create User'}</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </FormOverlay>
      )}

      <div className="card">
        <div className="form-group search-group">
          <Search size={18} />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search users..." />
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleUsers.map(user => (
                <tr key={user.id}>
                  <td>{user.name}</td><td>{user.email}</td><td><span className="role-badge">{user.role}</span></td>
                  <td><span className={`status-badge status-${user.status.toLowerCase()}`}>{user.status}</span></td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="action-buttons">
                    {(isSuperAdmin || user.role !== 'Super Admin') && <button className="btn-icon btn-edit" onClick={() => handleEdit(user)} aria-label="Edit user"><Edit size={16} /></button>}
                    {(isSuperAdmin || user.role !== 'Super Admin') && <button className="btn-icon btn-delete" onClick={() => handleDeactivate(user.id)} aria-label="Deactivate user"><UserX size={16} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Recent Audit Activity</h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Record</th><th>IP</th></tr></thead>
            <tbody>
              {auditLogs.slice(0, 25).map(log => (
                <tr key={log.id}><td>{new Date(log.created_at).toLocaleString()}</td><td>{log.user_name || 'System'}</td><td>{log.action}</td><td>{log.entity_type} {log.entity_id || ''}</td><td>{log.ip_address || '-'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
