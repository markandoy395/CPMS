import React, { useEffect, useMemo, useState } from 'react'
import { BookOpen, CheckCircle, Plus, RotateCcw, Search, XCircle } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorAlert } from '../components/ErrorAlert'
import { SuccessAlert } from '../components/SuccessAlert'
import { FormOverlay } from '../components/FormOverlay'
import { transactionService } from '../services/transactionService'
import { itemService } from '../services/itemService'
import { custodianService } from '../services/custodianService'
import { useAuth } from '../context/AuthContext'

function localDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : '-'
}

function formatDuration(startValue, endValue) {
  if (!startValue || !endValue) return '-'
  const startDate = new Date(`${startValue}T00:00:00`)
  const endDate = new Date(`${endValue}T00:00:00`)
  const days = Math.round((endDate - startDate) / (24 * 60 * 60 * 1000))
  if (!Number.isFinite(days) || days < 0) return '-'
  if (days === 0) return 'Same day'
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

function statusClass(status) {
  return String(status || '').toLowerCase().replace(/\s+/g, '-')
}

const SUPPLY_OFFICE = 'Supply Office'

function roomFromRemarks(remarks) {
  return /^Room:\s*([^;]+)/i.exec(String(remarks || ''))?.[1]?.trim() || ''
}

function requesterLocation(record) {
  return [record.department, roomFromRemarks(record.remarks)].filter(Boolean).join(' / ') || '-'
}

function emptyTransaction() {
  return { item_id: '', custodian_id: '', transaction_type: 'Issuance', notes: '', par_id: '', ics_id: '' }
}

function emptyBorrowing() {
  return {
    item_id: '',
    borrower_name: '',
    borrower_reference: '',
    department: '',
    contact_number: '',
    borrowed_date: localDate(),
    due_date: localDate(7),
    purpose: '',
    condition_out: 'Good',
    remarks: ''
  }
}

export default function TransactionsPage() {
  const { user } = useAuth()
  const canBorrow = ['Super Admin', 'Admin', 'Custodian'].includes(user?.role)
  const canReviewBorrowRequests = ['Super Admin', 'Admin'].includes(user?.role)
  const [transactions, setTransactions] = useState([])
  const [borrowings, setBorrowings] = useState([])
  const [borrowRequests, setBorrowRequests] = useState([])
  const [items, setItems] = useState([])
  const [custodians, setCustodians] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [borrowSearch, setBorrowSearch] = useState('')
  const [borrowStatus, setBorrowStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showBorrowForm, setShowBorrowForm] = useState(false)
  const [returningRecord, setReturningRecord] = useState(null)
  const [formData, setFormData] = useState(emptyTransaction)
  const [borrowForm, setBorrowForm] = useState(emptyBorrowing)
  const [returnForm, setReturnForm] = useState({ condition_return: 'Good', remarks: '' })

  const loadData = async () => {
    const [transactionResult, borrowingResult, itemResult, custodianResult, borrowRequestResult] = await Promise.all([
      transactionService.getAllTransactions(),
      transactionService.getBorrowings(),
      itemService.getAllItems(),
      custodianService.getAllCustodians(),
      canReviewBorrowRequests ? transactionService.getBorrowRequests({ status: 'Pending,Approved', needs_action: '1' }) : Promise.resolve({ success: true, data: [] })
    ])
    if (transactionResult.success) setTransactions(transactionResult.data)
    else setError(transactionResult.message)
    if (borrowingResult.success) setBorrowings(borrowingResult.data)
    else setError(borrowingResult.message)
    if (borrowRequestResult.success) setBorrowRequests(borrowRequestResult.data)
    else setError(borrowRequestResult.message)
    if (itemResult.success) setItems(itemResult.data)
    if (custodianResult.success) setCustodians(custodianResult.data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const submitTransaction = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const result = await transactionService.createTransaction(formData)
    if (result.success) {
      setSuccess('Transaction recorded and inventory updated successfully')
      setShowForm(false)
      setFormData(emptyTransaction())
      await loadData()
    } else setError(result.message)
    setSaving(false)
  }

  const submitBorrowing = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const result = await transactionService.createBorrowing(borrowForm)
    if (result.success) {
      setSuccess('Asset borrowing recorded successfully')
      setShowBorrowForm(false)
      setBorrowForm(emptyBorrowing())
      await loadData()
    } else setError(result.message)
    setSaving(false)
  }

  const submitReturn = async event => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const result = await transactionService.returnBorrowing(returningRecord.id, returnForm)
    if (result.success) {
      setSuccess('Borrowed asset returned successfully')
      setReturningRecord(null)
      setReturnForm({ condition_return: 'Good', remarks: '' })
      await loadData()
    } else setError(result.message)
    setSaving(false)
  }

  const approveBorrowRequest = async record => {
    setSaving(true)
    setError('')
    const result = await transactionService.approveBorrowRequest(record.id, {
      borrowed_date: record.requested_borrow_date,
      due_date: record.due_date,
      condition_out: record.item_condition || 'Good'
    })
    if (result.success) {
      const ticketMessage = result.data?.ticket_number ? ` Ticket ${result.data.ticket_number} is ready for the user.` : ''
      setSuccess(`Borrow request approved.${ticketMessage} Mark it as picked up once the item is released.`)
      await loadData()
    } else setError(result.message)
    setSaving(false)
  }

  const markBorrowRequestPickedUp = async record => {
    if (!window.confirm('Mark this item as picked up by the user?')) return
    setSaving(true)
    setError('')
    const result = await transactionService.markBorrowRequestPickedUp(record.id)
    if (result.success) {
      setSuccess('Item marked as picked up by the user')
      await loadData()
    } else setError(result.message)
    setSaving(false)
  }

  const rejectBorrowRequest = async record => {
    if (!window.confirm('Reject this borrow request?')) return
    setSaving(true)
    setError('')
    const result = await transactionService.rejectBorrowRequest(record.id)
    if (result.success) {
      setSuccess('Borrow request rejected')
      await loadData()
    } else setError(result.message)
    setSaving(false)
  }

  const filteredTransactions = useMemo(() => transactions.filter(transaction => {
    const searchable = `${transaction.items?.item_name || ''} ${transaction.items?.item_code || ''}`.toLowerCase()
    return searchable.includes(searchTerm.toLowerCase()) && (!typeFilter || transaction.transaction_type === typeFilter)
  }), [transactions, searchTerm, typeFilter])

  const filteredBorrowings = useMemo(() => borrowings.filter(record => {
    const searchable = `${record.borrower_name} ${record.borrower_reference || ''} ${record.item_name} ${record.item_code}`.toLowerCase()
    return searchable.includes(borrowSearch.toLowerCase()) && (!borrowStatus || record.status === borrowStatus)
  }), [borrowings, borrowSearch, borrowStatus])

  const pendingRequestCount = borrowRequests.filter(record => record.status === 'Pending').length
  const pickupRequestCount = borrowRequests.filter(record => record.status === 'Approved' && !record.picked_up_at).length
  const isBorrowingAwaitingPickup = record => Boolean(record.borrow_request_id && !record.picked_up_at && ['Borrowed', 'Overdue'].includes(record.status))
  const availableItems = items.filter(item => ['Active', 'Returned'].includes(item.status) && !item.custodian_id)

  if (loading) return <LoadingSpinner message="Loading transactions and borrowings..." />

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Transactions</h1><p>Property movement and short-term asset borrowing.</p></div>
        <div className="header-actions">
          {canBorrow && <button className="btn btn-secondary" onClick={() => { setBorrowForm(emptyBorrowing()); setShowBorrowForm(true) }}><BookOpen size={18} /> Borrow Asset</button>}
          {['Super Admin', 'Admin'].includes(user?.role) && <button className="btn btn-primary" onClick={() => { setFormData(emptyTransaction()); setShowForm(true) }}><Plus size={18} /> Record Transaction</button>}
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

      {showBorrowForm && (
        <FormOverlay title="Borrow Asset" description="Record the borrower, due date, purpose, and asset condition." onClose={() => setShowBorrowForm(false)} size="wide">
          <form onSubmit={submitBorrowing}>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Available Asset *</label>
                <select required value={borrowForm.item_id} onChange={event => setBorrowForm({ ...borrowForm, item_id: event.target.value })}>
                  <option value="">Select an available asset</option>
                  {availableItems.map(item => <option key={item.id} value={item.id}>{item.item_code} - {item.item_name} ({item.condition})</option>)}
                </select>
              </div>
              <div className="form-group"><label>Borrower Name *</label><input required value={borrowForm.borrower_name} onChange={event => setBorrowForm({ ...borrowForm, borrower_name: event.target.value })} /></div>
              <div className="form-group"><label>Borrower ID / Reference</label><input value={borrowForm.borrower_reference} onChange={event => setBorrowForm({ ...borrowForm, borrower_reference: event.target.value })} /></div>
              <div className="form-group"><label>Department / Office</label><input value={borrowForm.department} onChange={event => setBorrowForm({ ...borrowForm, department: event.target.value })} /></div>
              <div className="form-group"><label>Contact Number</label><input type="tel" value={borrowForm.contact_number} onChange={event => setBorrowForm({ ...borrowForm, contact_number: event.target.value })} /></div>
              <div className="form-group"><label>Borrowed Date *</label><input required type="date" value={borrowForm.borrowed_date} onChange={event => setBorrowForm({ ...borrowForm, borrowed_date: event.target.value })} /></div>
              <div className="form-group"><label>Due Date *</label><input required type="date" min={borrowForm.borrowed_date} value={borrowForm.due_date} onChange={event => setBorrowForm({ ...borrowForm, due_date: event.target.value })} /></div>
              <div className="form-group"><label>Condition on Release</label><select value={borrowForm.condition_out} onChange={event => setBorrowForm({ ...borrowForm, condition_out: event.target.value })}><option>New</option><option>Good</option><option>Fair</option><option>Damaged</option><option>Under Repair</option></select></div>
              <div className="form-group full-width"><label>Purpose</label><textarea rows="3" value={borrowForm.purpose} onChange={event => setBorrowForm({ ...borrowForm, purpose: event.target.value })} /></div>
              <div className="form-group full-width"><label>Remarks</label><textarea rows="2" value={borrowForm.remarks} onChange={event => setBorrowForm({ ...borrowForm, remarks: event.target.value })} /></div>
            </div>
            <div className="form-actions"><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Record Borrowing'}</button><button type="button" className="btn btn-secondary" onClick={() => setShowBorrowForm(false)}>Cancel</button></div>
          </form>
        </FormOverlay>
      )}

      {returningRecord && (
        <FormOverlay title="Return Borrowed Asset" description={`${returningRecord.item_code} - ${returningRecord.item_name} borrowed by ${returningRecord.borrower_name}.`} onClose={() => setReturningRecord(null)}>
          <form onSubmit={submitReturn}>
            <div className="form-grid">
              <div className="form-group"><label>Condition on Return *</label><select value={returnForm.condition_return} onChange={event => setReturnForm({ ...returnForm, condition_return: event.target.value })}><option>New</option><option>Good</option><option>Fair</option><option>Damaged</option><option>Under Repair</option></select></div>
              <div className="form-group full-width"><label>Return Remarks</label><textarea rows="3" value={returnForm.remarks} onChange={event => setReturnForm({ ...returnForm, remarks: event.target.value })} /></div>
            </div>
            <div className="form-actions"><button className="btn btn-primary" disabled={saving}><RotateCcw size={18} /> {saving ? 'Returning...' : 'Confirm Return'}</button><button type="button" className="btn btn-secondary" onClick={() => setReturningRecord(null)}>Cancel</button></div>
          </form>
        </FormOverlay>
      )}

      {showForm && (
        <FormOverlay title="Record New Transaction" description="Issue, transfer, return, or dispose of an inventory item." onClose={() => setShowForm(false)}>
          <form onSubmit={submitTransaction}>
            <div className="form-grid">
              <div className="form-group"><label>Item</label><select required value={formData.item_id} onChange={event => setFormData({ ...formData, item_id: event.target.value })}><option value="">Select item</option>{items.map(item => <option key={item.id} value={item.id}>{item.item_code} - {item.item_name} ({item.status})</option>)}</select></div>
              <div className="form-group"><label>Receiving Custodian</label><select value={formData.custodian_id} onChange={event => setFormData({ ...formData, custodian_id: event.target.value })} required={['Issuance', 'Transfer'].includes(formData.transaction_type)}><option value="">None</option>{custodians.filter(record => record.status === 'Active').map(record => <option key={record.id} value={record.id}>{record.users?.name} - {record.department}</option>)}</select></div>
              <div className="form-group"><label>Transaction Type</label><select value={formData.transaction_type} onChange={event => setFormData({ ...formData, transaction_type: event.target.value })}><option>Issuance</option><option>Transfer</option><option>Return</option><option>Disposal</option></select></div>
              <div className="form-group"><label>PAR ID</label><input value={formData.par_id} onChange={event => setFormData({ ...formData, par_id: event.target.value })} /></div>
              <div className="form-group"><label>ICS ID</label><input value={formData.ics_id} onChange={event => setFormData({ ...formData, ics_id: event.target.value })} /></div>
              <div className="form-group full-width"><label>Notes</label><textarea rows="3" value={formData.notes} onChange={event => setFormData({ ...formData, notes: event.target.value })} /></div>
            </div>
            <div className="form-actions"><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Record Transaction'}</button><button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button></div>
          </form>
        </FormOverlay>
      )}

      {canReviewBorrowRequests && (
        <section className="card transaction-section">
          <div className="transaction-section-header">
            <div><h2>Borrow Requests</h2><p>Review new requests and confirm when approved users pick up items.</p></div>
            <span>{pendingRequestCount} pending / {pickupRequestCount} pickup</span>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>Asset</th><th>Requester</th><th>Borrow Date</th><th>Due</th><th>Duration</th><th>Purpose</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {borrowRequests.length ? borrowRequests.map(record => (
                  <tr key={record.id}>
                    <td><strong>{record.item_code}</strong><br /><span className="table-secondary">{record.item_name}</span><br /><span className="table-secondary">Source: {SUPPLY_OFFICE}</span></td>
                    <td>{record.borrower_name}<br /><span className="table-secondary">{record.requester_name || record.borrower_reference || record.contact_number || 'Public user'}</span><br /><span className="table-secondary">{requesterLocation(record)}</span></td>
                    <td>{formatDate(record.requested_borrow_date)}</td>
                    <td>{formatDate(record.due_date)}</td>
                    <td>{formatDuration(record.requested_borrow_date, record.due_date)}</td>
                    <td>{record.purpose || '-'}</td>
                    <td>
                      <span className={`status-badge status-${statusClass(record.status)}`}>{record.status}</span>
                      {record.status === 'Approved' && !record.picked_up_at && <><br /><span className="table-secondary">Waiting for pickup</span></>}
                    </td>
                    <td>
                      <div className="borrow-request-actions">
                        {record.status === 'Pending' ? (
                          <>
                            <button className="btn btn-secondary btn-table-action" disabled={saving} onClick={() => approveBorrowRequest(record)}><CheckCircle size={16} /> Accept</button>
                            <button className="btn btn-secondary btn-table-action" disabled={saving} onClick={() => rejectBorrowRequest(record)}><XCircle size={16} /> Reject</button>
                          </>
                        ) : (
                          <button className="btn btn-secondary btn-table-action" disabled={saving} onClick={() => markBorrowRequestPickedUp(record)}><CheckCircle size={16} /> Item Picked Up</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan="8" className="text-center">No borrow requests need admin action</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card transaction-section">
        <div className="transaction-section-header"><div><h2>Borrowing Register</h2><p>Active, overdue, and returned short-term asset loans.</p></div><span>{borrowings.filter(record => ['Borrowed', 'Overdue'].includes(record.status)).length} open</span></div>
        <div className="search-inputs transaction-filters">
          <div className="form-group search-group"><Search size={18} /><input value={borrowSearch} onChange={event => setBorrowSearch(event.target.value)} placeholder="Search borrower or asset..." /></div>
          <div className="form-group"><select value={borrowStatus} onChange={event => setBorrowStatus(event.target.value)}><option value="">All borrowing statuses</option><option>Borrowed</option><option>Overdue</option><option>Returned</option><option>Cancelled</option></select></div>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead><tr><th>Asset</th><th>Borrower</th><th>Borrowed</th><th>Due</th><th>Condition</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {filteredBorrowings.length ? filteredBorrowings.map(record => {
                const awaitingPickup = isBorrowingAwaitingPickup(record)
                return (
                  <tr key={record.id}>
                    <td><strong>{record.item_code}</strong><br /><span className="table-secondary">{record.item_name}</span><br /><span className="table-secondary">Source: {SUPPLY_OFFICE}</span></td>
                    <td>{record.borrower_name}<br /><span className="table-secondary">{record.borrower_reference || record.department || '-'}</span></td>
                    <td>{formatDate(record.borrowed_date)}</td>
                    <td>{formatDate(record.due_date)}</td>
                    <td>{record.status === 'Returned' ? record.condition_return : record.condition_out}</td>
                    <td>
                      {awaitingPickup ? (
                        <>
                          <span className="status-badge status-pending">Awaiting Pickup</span>
                          <br /><span className="table-secondary">{record.ticket_number || 'Approved request'}</span>
                        </>
                      ) : (
                        <span className={`status-badge status-${statusClass(record.status)}`}>{record.status}</span>
                      )}
                    </td>
                    <td>
                      {canBorrow && ['Borrowed', 'Overdue'].includes(record.status) && (awaitingPickup ? (
                        <span className="table-secondary">Pickup not confirmed</span>
                      ) : (
                        <button className="btn btn-secondary btn-table-action" onClick={() => { setReturnForm({ condition_return: 'Good', remarks: '' }); setReturningRecord(record) }}><RotateCcw size={16} /> Return</button>
                      ))}
                    </td>
                  </tr>
                )
              }) : <tr><td colSpan="7" className="text-center">No borrowing records found</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card transaction-section">
        <div className="transaction-section-header"><div><h2>Property Transactions</h2><p>Permanent issuance, transfer, return, and disposal history.</p></div></div>
        <form className="search-inputs transaction-filters" onSubmit={event => event.preventDefault()}>
          <div className="form-group search-group"><Search size={18} /><input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search transactions..." /></div>
          <div className="form-group"><select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="">All transaction types</option><option>Issuance</option><option>Transfer</option><option>Return</option><option>Disposal</option></select></div>
        </form>
        <div className="table-responsive">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Custodian</th><th>Issued By</th><th>PAR ID</th><th>ICS ID</th></tr></thead>
            <tbody>{filteredTransactions.length ? filteredTransactions.map(transaction => (
              <tr key={transaction.id}><td>{new Date(transaction.transaction_date).toLocaleDateString()}</td><td>{transaction.items?.item_name || 'N/A'}</td><td><span className={`status-badge status-${transaction.transaction_type.toLowerCase()}`}>{transaction.transaction_type}</span></td><td>{transaction.custodians?.users?.name || 'N/A'}</td><td>{transaction.issuer?.name || 'N/A'}</td><td>{transaction.par_id || '-'}</td><td>{transaction.ics_id || '-'}</td></tr>
            )) : <tr><td colSpan="7" className="text-center">No transactions found</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
