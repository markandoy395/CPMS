import React, { useEffect, useState } from 'react'
import { ClipboardCheck, Plus, Wrench } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { custodianService } from '../services/custodianService'
import { itemService } from '../services/itemService'
import { ErrorAlert } from '../components/ErrorAlert'
import { SuccessAlert } from '../components/SuccessAlert'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { FormOverlay } from '../components/FormOverlay'

const maintenanceInitial = { item_id: '', custodian_id: '', maintenance_type: '', scheduled_date: '', cost: 0, notes: '', status: 'Pending' }
const verificationInitial = { custodian_id: '', total_items_expected: 0, items_found: 0, discrepancies: '' }

export default function OperationsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [custodians, setCustodians] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [verifications, setVerifications] = useState([])
  const [maintenanceForm, setMaintenanceForm] = useState(maintenanceInitial)
  const [verificationForm, setVerificationForm] = useState(verificationInitial)
  const [showMaintenance, setShowMaintenance] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = async () => {
    setLoading(true)
    const [itemsResult, custodiansResult, maintenanceResult, verificationResult] = await Promise.all([
      itemService.getAllItems(),
      custodianService.getAllCustodians(),
      custodianService.getMaintenanceRecords(),
      custodianService.getVerificationHistory()
    ])
    if (itemsResult.success) setItems(itemsResult.data)
    if (custodiansResult.success) setCustodians(custodiansResult.data)
    if (maintenanceResult.success) setMaintenance(maintenanceResult.data)
    if (verificationResult.success) setVerifications(verificationResult.data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const submitMaintenance = async (event) => {
    event.preventDefault()
    const result = await custodianService.scheduleMaintenance(maintenanceForm.custodian_id, maintenanceForm.item_id, maintenanceForm)
    if (result.success) {
      setSuccess('Maintenance scheduled successfully.')
      setMaintenanceForm(maintenanceInitial)
      setShowMaintenance(false)
      loadData()
    } else setError(result.message)
  }

  const submitVerification = async (event) => {
    event.preventDefault()
    const result = await custodianService.performInventoryVerification(verificationForm.custodian_id, {
      ...verificationForm,
      discrepancies: verificationForm.discrepancies ? [verificationForm.discrepancies] : []
    })
    if (result.success) {
      setSuccess('Physical inventory verification recorded.')
      setVerificationForm(verificationInitial)
      setShowVerification(false)
      loadData()
    } else setError(result.message)
  }

  const updateMaintenance = async (id, status) => {
    const result = await custodianService.updateMaintenanceStatus(id, status)
    if (result.success) loadData()
    else setError(result.message)
  }

  if (loading && maintenance.length === 0) return <LoadingSpinner message="Loading operations..." />

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Operations</h1><p>Maintenance and physical inventory control.</p></div>
        <div className="header-actions">
          {['Super Admin', 'Admin', 'Custodian'].includes(user?.role) && <button className="btn btn-secondary" onClick={() => setShowMaintenance(current => !current)}><Wrench size={18} /> Schedule Maintenance</button>}
          {['Super Admin', 'Admin', 'Auditor'].includes(user?.role) && <button className="btn btn-primary" onClick={() => setShowVerification(current => !current)}><ClipboardCheck size={18} /> Record Verification</button>}
        </div>
      </div>
      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}

      {showMaintenance && (
        <FormOverlay title="Schedule Maintenance" description="Create a maintenance schedule for an inventory item." onClose={() => setShowMaintenance(false)}>
          <form onSubmit={submitMaintenance}>
          <div className="form-grid">
            <div className="form-group"><label>Item</label><select required value={maintenanceForm.item_id} onChange={e => setMaintenanceForm({ ...maintenanceForm, item_id: e.target.value })}><option value="">Select item</option>{items.map(item => <option key={item.id} value={item.id}>{item.item_code} - {item.item_name}</option>)}</select></div>
            <div className="form-group"><label>Custodian</label><select value={maintenanceForm.custodian_id} onChange={e => setMaintenanceForm({ ...maintenanceForm, custodian_id: e.target.value })}><option value="">None</option>{custodians.map(c => <option key={c.id} value={c.id}>{c.users?.name}</option>)}</select></div>
            <div className="form-group"><label>Maintenance Type</label><input required value={maintenanceForm.maintenance_type} onChange={e => setMaintenanceForm({ ...maintenanceForm, maintenance_type: e.target.value })} /></div>
            <div className="form-group"><label>Scheduled Date</label><input required type="date" value={maintenanceForm.scheduled_date} onChange={e => setMaintenanceForm({ ...maintenanceForm, scheduled_date: e.target.value })} /></div>
            <div className="form-group"><label>Estimated Cost</label><input type="number" min="0" step="0.01" value={maintenanceForm.cost} onChange={e => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })} /></div>
            <div className="form-group full-width"><label>Notes</label><textarea value={maintenanceForm.notes} onChange={e => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })} /></div>
          </div><div className="form-actions"><button className="btn btn-primary"><Plus size={18} /> Save Schedule</button><button type="button" className="btn btn-secondary" onClick={() => setShowMaintenance(false)}>Cancel</button></div>
          </form>
        </FormOverlay>
      )}

      {showVerification && (
        <FormOverlay title="Physical Inventory Verification" description="Record counted items and any discrepancies found." onClose={() => setShowVerification(false)}>
          <form onSubmit={submitVerification}>
          <div className="form-grid">
            <div className="form-group"><label>Custodian</label><select required value={verificationForm.custodian_id} onChange={e => setVerificationForm({ ...verificationForm, custodian_id: e.target.value })}><option value="">Select custodian</option>{custodians.map(c => <option key={c.id} value={c.id}>{c.users?.name} - {c.department}</option>)}</select></div>
            <div className="form-group"><label>Expected Items</label><input required type="number" min="0" value={verificationForm.total_items_expected} onChange={e => setVerificationForm({ ...verificationForm, total_items_expected: Number(e.target.value) })} /></div>
            <div className="form-group"><label>Items Found</label><input required type="number" min="0" value={verificationForm.items_found} onChange={e => setVerificationForm({ ...verificationForm, items_found: Number(e.target.value) })} /></div>
            <div className="form-group full-width"><label>Discrepancy Notes</label><textarea value={verificationForm.discrepancies} onChange={e => setVerificationForm({ ...verificationForm, discrepancies: e.target.value })} /></div>
          </div><div className="form-actions"><button className="btn btn-primary"><ClipboardCheck size={18} /> Save Verification</button><button type="button" className="btn btn-secondary" onClick={() => setShowVerification(false)}>Cancel</button></div>
          </form>
        </FormOverlay>
      )}

      <div className="card"><h3>Maintenance Records</h3><div className="table-responsive"><table className="data-table">
        <thead><tr><th>Item</th><th>Type</th><th>Scheduled</th><th>Cost</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{maintenance.map(record => <tr key={record.id}><td>{record.item_code} - {record.item_name}</td><td>{record.maintenance_type}</td><td>{record.scheduled_date}</td><td>PHP {Number(record.cost).toLocaleString()}</td><td><span className={`status-badge status-${record.status.toLowerCase().replaceAll(' ', '-')}`}>{record.status}</span></td><td>{record.status !== 'Completed' && ['Super Admin', 'Admin', 'Custodian'].includes(user?.role) && <button className="btn btn-secondary" onClick={() => updateMaintenance(record.id, 'Completed')}>Complete</button>}</td></tr>)}</tbody>
      </table></div></div>

      <div className="card"><h3>Verification History</h3><div className="table-responsive"><table className="data-table">
        <thead><tr><th>Date</th><th>Custodian</th><th>Expected</th><th>Found</th><th>Missing</th><th>Status</th></tr></thead>
        <tbody>{verifications.map(record => <tr key={record.id}><td>{new Date(record.verification_date).toLocaleString()}</td><td>{record.custodian_name}</td><td>{record.total_items_expected}</td><td>{record.items_found}</td><td>{record.items_missing}</td><td><span className="status-badge">{record.status}</span></td></tr>)}</tbody>
      </table></div></div>
    </div>
  )
}
