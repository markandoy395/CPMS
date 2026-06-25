import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Search, ScanLine, Printer, Paperclip, CheckCircle, AlertCircle, X } from 'lucide-react'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ErrorAlert } from '../components/ErrorAlert'
import { SuccessAlert } from '../components/SuccessAlert'
import { itemService } from '../services/itemService'
import { custodianService } from '../services/custodianService'
import { useAuth } from '../context/AuthContext'
import { AssetScanner } from '../components/AssetScanner'
import { AssetLabelModal } from '../components/AssetLabelModal'
import { AssetAttachments } from '../components/AssetAttachments'
import { FormOverlay } from '../components/FormOverlay'
import { CursorTooltip } from '../components/CursorTooltip'

const SUPPLY_OFFICE = 'Supply Office'

function numberValue(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function createEmptyItemForm() {
  return {
    item_name: '',
    description: '',
    category: '',
    subcategory: '',
    item_code: '',
    serial_number: '',
    model_number: '',
    brand: '',
    purchase_date: new Date().toISOString().split('T')[0],
    po_number: '',
    vendor: '',
    invoice_number: '',
    unit_cost: 0,
    total_cost: 0,
    funding_source: '',
    campus: '',
    building: SUPPLY_OFFICE,
    room_number: SUPPLY_OFFICE,
    department: SUPPLY_OFFICE,
    assigned_to: '',
    custodian_id: '',
    asset_type: 'Fixed Asset',
    quantity: 1,
    condition: 'New',
    warranty_expiry: '',
    maintenance_schedule: '',
    insurance_policy: '',
    status: 'Active'
  }
}

function normalizeItemForm(data) {
  return {
    ...data,
    building: data.building || SUPPLY_OFFICE,
    room_number: data.room_number || SUPPLY_OFFICE,
    department: SUPPLY_OFFICE
  }
}

export default function InventoryPage() {
  const { user } = useAuth()
  const canManage = ['Super Admin', 'Admin'].includes(user?.role)
  const canAdd = ['Super Admin', 'Admin', 'Custodian'].includes(user?.role)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [custodians, setCustodians] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [scannerTarget, setScannerTarget] = useState(null)
  const [labelItem, setLabelItem] = useState(null)
  const [attachmentItem, setAttachmentItem] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const [formData, setFormData] = useState(createEmptyItemForm)

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    try {
      setError('')
      const [result, custodianResult] = await Promise.all([
        itemService.getAllItems(),
        custodianService.getAllCustodians({ status: 'Active' })
      ])
      if (result.success) {
        setItems(result.data)
      } else {
        setError(result.message)
      }
      if (custodianResult.success) setCustodians(custodianResult.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    setScanResult(null)
    setLoading(true)
    const result = await itemService.getAllItems({
      search: searchTerm,
      category: categoryFilter,
      status: statusFilter
    })
    if (result.success) {
      setItems(result.data)
    }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = normalizeItemForm(formData)
      let result
      if (editingId) {
        result = await itemService.updateItem(editingId, payload)
      } else {
        result = await itemService.createItem(payload)
      }

      if (result.success) {
        setSuccess(editingId ? 'Item updated successfully' : 'Item created successfully')
        setShowForm(false)
        setEditingId(null)
        setFormData(createEmptyItemForm())
        setScanResult(null)
        loadItems()
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
    if (!window.confirm('Are you sure you want to delete this item?')) return

    setLoading(true)
    const result = await itemService.deleteItem(id)
    if (result.success) {
      setSuccess('Item deleted successfully')
      loadItems()
    } else {
      setError(result.message)
    }
    setLoading(false)
  }

  const handleEdit = (item) => {
    setFormData(normalizeItemForm({ ...item, condition: item.condition || item.condition_status || 'New' }))
    setEditingId(item.id)
    setShowForm(true)
  }

  const closeItemForm = () => {
    setShowForm(false)
    setEditingId(null)
  }

  const openNewItemForm = (itemCode = '') => {
    setEditingId(null)
    setFormData({ ...createEmptyItemForm(), item_code: itemCode })
    setShowForm(true)
  }

  const handleScannedCode = async (code) => {
    const target = scannerTarget
    setScannerTarget(null)

    if (target === 'item_code' || target === 'serial_number') {
      setFormData(current => ({ ...current, [target]: code }))
      setSuccess(target === 'item_code' ? 'Item code captured' : 'Serial number captured')
      return
    }

    setSearchTerm(code)
    setCategoryFilter('')
    setStatusFilter('')
    setLoading(true)
    const result = await itemService.getAllItems({ search: code })
    if (result.success) {
      setItems(result.data)
      if (result.data.length > 0) {
        setScanResult({ code, item: result.data[0], matches: result.data.length })
        setSuccess(`Asset found: ${result.data[0].item_name}`)
      } else {
        setScanResult({ code, item: null, matches: 0 })
        setError(`No registered asset found for code: ${code}`)
      }
    } else {
      setScanResult({ code, item: null, matches: 0, failed: true })
      setError(result.message)
    }
    setLoading(false)
  }

  const filteredItems = items.filter(item => {
    const searchable = `${item.item_name} ${item.item_code} ${item.serial_number || ''}`.toLowerCase()
    const matchesSearch = searchable.includes(searchTerm.toLowerCase())
    const matchesCategory = !categoryFilter || item.category === categoryFilter
    const matchesStatus = !statusFilter || item.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  if (loading && !items.length) return <LoadingSpinner message="Loading inventory..." />

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Inventory Management</h1>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setScannerTarget('search')}><ScanLine size={18} /> Scan Asset</button>
          {canAdd && <button className="btn btn-primary" onClick={() => openNewItemForm()}><Plus size={18} /> Add Item</button>}
        </div>
      </div>

      {error && <ErrorAlert message={error} onClose={() => setError('')} />}
      {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}
      {scannerTarget && <AssetScanner onDetected={handleScannedCode} onClose={() => setScannerTarget(null)} />}
      {labelItem && <AssetLabelModal item={labelItem} onClose={() => setLabelItem(null)} />}
      {attachmentItem && <AssetAttachments item={attachmentItem} onClose={() => setAttachmentItem(null)} />}

      {scanResult && (
        <section className={`scanned-asset-result ${scanResult.item ? 'is-found' : 'is-missing'}`} aria-live="polite">
          <div className="scanned-asset-result-icon">
            {scanResult.item ? <CheckCircle size={23} /> : <AlertCircle size={23} />}
          </div>
          <div className="scanned-asset-result-content">
            <div className="scanned-asset-result-heading">
              <div>
                <span>Scanned Asset Result</span>
                <h2>{scanResult.item ? scanResult.item.item_name : 'Asset is not registered'}</h2>
              </div>
              <button className="btn-icon" type="button" onClick={() => setScanResult(null)} aria-label="Clear scan result"><X size={18} /></button>
            </div>
            <dl className="scanned-asset-details">
              <div><dt>Scanned code</dt><dd>{scanResult.code}</dd></div>
              {scanResult.item && <>
                <div><dt>Item code</dt><dd>{scanResult.item.item_code}</dd></div>
                <div><dt>Serial number</dt><dd>{scanResult.item.serial_number || 'N/A'}</dd></div>
                <div><dt>Status</dt><dd>{scanResult.item.status}</dd></div>
                <div><dt>Source office</dt><dd>{SUPPLY_OFFICE}</dd></div>
              </>}
            </dl>
            <div className="scanned-asset-actions">
              {scanResult.item ? <>
                <button className="btn btn-secondary" type="button" onClick={() => setLabelItem(scanResult.item)}><Printer size={17} /> Print Label</button>
                <button className="btn btn-secondary" type="button" onClick={() => setAttachmentItem(scanResult.item)}><Paperclip size={17} /> Photos & Files</button>
              </> : canAdd && !scanResult.failed && (
                <button className="btn btn-primary" type="button" onClick={() => openNewItemForm(scanResult.code)}><Plus size={17} /> Add to Inventory</button>
              )}
            </div>
          </div>
        </section>
      )}

      {showForm && (
        <FormOverlay
          title={editingId ? 'Edit Item' : 'Add New Item'}
          description="Enter the property information and identification details."
          onClose={closeItemForm}
          size="wide"
        >
          <form onSubmit={handleSubmit}>
            {/* Basic Item Information */}
            <div className="form-section">
              <h4>Basic Item Information</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Item Name *</label>
                  <input
                    type="text"
                    value={formData.item_name}
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                    placeholder="e.g., Dell Laptop"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    <option value="">Select Category</option>
                    <option value="IT Equipment">IT Equipment</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Lab Equipment">Lab Equipment</option>
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="Books">Books</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Subcategory</label>
                  <input
                    type="text"
                    value={formData.subcategory}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    placeholder="e.g., Laptop, Desktop, Monitor"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Item description and specifications..."
                    rows="3"
                  />
                </div>
              </div>
            </div>

            {/* Identification Details */}
            <div className="form-section">
              <h4>Identification Details</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Item Code *</label>
                  <div className="inventory-code-input">
                    <input
                      type="text"
                      value={formData.item_code}
                      onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                      placeholder="Type or scan item code"
                      required
                    />
                    <button type="button" className="btn btn-secondary" onClick={() => setScannerTarget('item_code')} title="Scan item code">
                      <ScanLine size={18} /> Scan
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Serial Number</label>
                  <div className="inventory-code-input">
                    <input
                      type="text"
                      value={formData.serial_number}
                      onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                      placeholder="Type or scan serial number"
                    />
                    <button type="button" className="btn btn-secondary" onClick={() => setScannerTarget('serial_number')} title="Scan serial number">
                      <ScanLine size={18} /> Scan
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Brand/Manufacturer</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g., Dell, HP, etc."
                  />
                </div>
                <div className="form-group">
                  <label>Model Number</label>
                  <input
                    type="text"
                    value={formData.model_number}
                    onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                    placeholder="e.g., XPS 13, EliteBook 840"
                  />
                </div>
              </div>
            </div>

            {/* Purchase Information */}
            <div className="form-section">
              <h4>Purchase Information</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>PO Number</label>
                  <input
                    type="text"
                    value={formData.po_number}
                    onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                    placeholder="e.g., PO-2024-001"
                  />
                </div>
                <div className="form-group">
                  <label>Vendor/Supplier</label>
                  <input
                    type="text"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    placeholder="e.g., Dell Computers"
                  />
                </div>
                <div className="form-group">
                  <label>Invoice Number</label>
                  <input
                    type="text"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    placeholder="e.g., INV-2024-001"
                  />
                </div>
                <div className="form-group">
                  <label>Unit Cost ($)</label>
                  <input
                    type="number"
                    value={formData.unit_cost}
                    onChange={(e) => setFormData({ ...formData, unit_cost: numberValue(e.target.value) })}
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Total Cost ($)</label>
                  <input
                    type="number"
                    value={formData.total_cost}
                    onChange={(e) => setFormData({ ...formData, total_cost: numberValue(e.target.value) })}
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Funding Source</label>
                  <select
                    value={formData.funding_source}
                    onChange={(e) => setFormData({ ...formData, funding_source: e.target.value })}
                  >
                    <option value="">Select Funding Source</option>
                    <option value="Operational Budget">Operational Budget</option>
                    <option value="Capital Fund">Capital Fund</option>
                    <option value="Grant">Grant</option>
                    <option value="Donation">Donation</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Supply source and assignment */}
            <div className="form-section">
              <h4>Supply Source & Assignment</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Campus</label>
                  <input
                    type="text"
                    value={formData.campus}
                    onChange={(e) => setFormData({ ...formData, campus: e.target.value })}
                    placeholder="e.g., Main Campus"
                  />
                </div>
                <div className="form-group">
                  <label>Supply Building</label>
                  <input
                    type="text"
                    value={formData.building}
                    onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                    placeholder="e.g., Supply Office"
                  />
                </div>
                <div className="form-group">
                  <label>Supply Room</label>
                  <input
                    type="text"
                    value={formData.room_number}
                    onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                    placeholder="e.g., Supply Office"
                  />
                </div>
                <div className="form-group">
                  <label>Source Office</label>
                  <input
                    type="text"
                    value={SUPPLY_OFFICE}
                    readOnly
                  />
                </div>
                <div className="form-group">
                  <label>Assigned To (Staff Name)</label>
                  <input
                    type="text"
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    placeholder="e.g., John Smith"
                  />
                </div>
                <div className="form-group">
                  <label>Assigned Custodian</label>
                  <select
                    value={formData.custodian_id}
                    onChange={(e) => setFormData({ ...formData, custodian_id: e.target.value })}
                  >
                    <option value="">None</option>
                    {custodians.map(custodian => (
                      <option key={custodian.id} value={custodian.id}>
                        {custodian.users?.name || custodian.name || 'Custodian'} - {custodian.department}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Asset Classification */}
            <div className="form-section">
              <h4>Asset Classification</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Asset Type</label>
                  <select
                    value={formData.asset_type}
                    onChange={(e) => setFormData({ ...formData, asset_type: e.target.value })}
                  >
                    <option value="Fixed Asset">Fixed Asset</option>
                    <option value="Consumable">Consumable</option>
                    <option value="Non-Consumable">Non-Consumable</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, numberValue(e.target.value, 1)) })}
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label>Condition</label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  >
                    <option value="New">New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Under Repair">Under Repair</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Warranty Expiry Date</label>
                  <input
                    type="date"
                    value={formData.warranty_expiry}
                    onChange={(e) => setFormData({ ...formData, warranty_expiry: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Tracking & Compliance */}
            <div className="form-section">
              <h4>Tracking & Compliance</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Maintenance Schedule</label>
                  <select
                    value={formData.maintenance_schedule}
                    onChange={(e) => setFormData({ ...formData, maintenance_schedule: e.target.value })}
                  >
                    <option value="">None</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Semi-Annual">Semi-Annual</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Insurance Policy Number</label>
                  <input
                    type="text"
                    value={formData.insurance_policy}
                    onChange={(e) => setFormData({ ...formData, insurance_policy: e.target.value })}
                    placeholder="e.g., INS-2024-001"
                  />
                </div>
                <div className="form-group">
                  <label>Asset Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Borrowed">Borrowed</option>
                    <option value="In Repair">In Repair</option>
                    <option value="Returned">Returned</option>
                    <option value="Disposed">Disposed</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : editingId ? 'Update Item' : 'Create Item'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeItemForm}
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
                placeholder="Search items..."
              />
            </div>
            <div className="form-group">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="IT Equipment">IT Equipment</option>
                <option value="Furniture">Furniture</option>
                <option value="Office Supplies">Office Supplies</option>
              </select>
            </div>
            <div className="form-group">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Assigned">Assigned</option>
                <option value="In Repair">In Repair</option>
                <option value="Returned">Returned</option>
                <option value="Disposed">Disposed</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
          </div>
        </form>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Serial #</th>
                <th>Condition</th>
                <th>Source Office</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <tr key={item.id}>
                    <td>{item.item_code}</td>
                    <td>{item.item_name}</td>
                    <td>{item.category}</td>
                    <td>{item.serial_number || 'N/A'}</td>
                    <td>{item.condition || 'N/A'}</td>
                    <td>{SUPPLY_OFFICE}</td>
                    <td>
                      <span className={`status-badge status-${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="action-buttons">
                      <CursorTooltip label="Print asset label">
                        <button className="btn-icon" onClick={() => setLabelItem(item)} aria-label="Print asset label"><Printer size={16} /></button>
                      </CursorTooltip>
                      <CursorTooltip label="Photos and files">
                        <button className="btn-icon" onClick={() => setAttachmentItem(item)} aria-label="Open photos and files"><Paperclip size={16} /></button>
                      </CursorTooltip>
                      {canManage && <>
                      <CursorTooltip label="Edit asset">
                        <button
                          className="btn-icon btn-edit"
                          onClick={() => handleEdit(item)}
                          aria-label="Edit asset"
                        >
                          <Edit size={16} />
                        </button>
                      </CursorTooltip>
                      <CursorTooltip label="Delete asset">
                        <button
                          className="btn-icon btn-delete"
                          onClick={() => handleDelete(item.id)}
                          aria-label="Delete asset"
                        >
                          <Trash2 size={16} />
                        </button>
                      </CursorTooltip>
                      </>}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center">No items found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
