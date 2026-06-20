import React, { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Download, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { SuccessAlert } from '../components/SuccessAlert'
import { ErrorAlert } from '../components/ErrorAlert'

const templateModules = import.meta.glob('../../assets/excel/*.{xlsx,docx}', {
  eager: true,
  query: '?url',
  import: 'default'
})

const templates = Object.entries(templateModules).map(([path, url]) => {
  const name = path.split('/').pop()
  const extension = name.split('.').pop().toLowerCase()
  const type = extension === 'docx' ? 'Document' : 'Excel'

  return {
    name,
    url,
    extension,
    type
  }
})

const initialFormData = {
  division: '',
  officer: '',
  risn: '',
  dateris: '',
  rc: 'ED-SO-004B',
  code: '',
  sain: '',
  datesai: '',
  revision: '000',
  dateeffective: '',
  purose: '',
  requestedname: '',
  requesteddesignation: '',
  requesteddate: '',
  approveddate: '',
  issuedname: '',
  issueddesignation: '',
  issueddate: '',
  reveivedname: '',
  receiveddesignation: '',
  receiveddate: ''
}

const initialLineItem = {
  stockno: '',
  unit: '',
  description: '',
  quantity1: '',
  quantity2: '',
  price: '',
  remarks: ''
}

const draftStorageKey = 'cpms-ris-form-draft'

const loadDraft = () => {
  if (typeof window === 'undefined') return null

  try {
    const savedDraft = window.localStorage.getItem(draftStorageKey)
    if (!savedDraft) return null

    return JSON.parse(savedDraft)
  } catch {
    return null
  }
}

const getInitialFormData = () => {
  const draft = loadDraft()

  return {
    ...initialFormData,
    ...(draft?.formData || {})
  }
}

const getInitialLineItems = () => {
  const draft = loadDraft()
  if (!Array.isArray(draft?.lineItems) || draft.lineItems.length === 0) {
    return [{ ...initialLineItem }]
  }

  return draft.lineItems.map(item => ({
    ...initialLineItem,
    ...item
  }))
}

const getInitialTemplateName = () => {
  const draft = loadDraft()

  return draft?.selectedTemplateName || ''
}

const sections = [
  { name: 'requestedname', label: 'Requested By - Printed Name' },
  { name: 'requesteddesignation', label: 'Requested By - Designation' },
  { name: 'requesteddate', label: 'Requested By - Date', type: 'date' },
  { name: 'approveddate', label: 'Approved By - Date', type: 'date' },
  { name: 'issuedname', label: 'Issued By - Printed Name' },
  { name: 'issueddesignation', label: 'Issued By - Designation' },
  { name: 'issueddate', label: 'Issued By - Date', type: 'date' },
  { name: 'reveivedname', label: 'Received By - Printed Name' },
  { name: 'receiveddesignation', label: 'Received By - Designation' },
  { name: 'receiveddate', label: 'Received By - Date', type: 'date' }
]

const escapeXml = (value) => {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

const getOutputFileName = (fileName) => {
  const index = fileName.lastIndexOf('.')
  if (index === -1) return `${fileName}-filled`

  return `${fileName.slice(0, index)}-filled${fileName.slice(index)}`
}

const getFirstLineItemVariables = (lineItems) => {
  return Object.fromEntries(
    Object.entries(lineItems[0] || initialLineItem).map(([key, value]) => [`{${key}}`, value])
  )
}

const setWorksheetCell = (xml, cellRef, value) => {
  const safeValue = escapeXml(value)
  const cellPattern = new RegExp(`<c\\b(?=[^>]*\\br="${cellRef}")[^>]*/>|<c\\b(?=[^>]*\\br="${cellRef}")[^>]*>[\\s\\S]*?<\\/c>`)

  if (cellPattern.test(xml)) {
    return xml.replace(cellPattern, (cell) => {
      const style = cell.match(/\ss="[^"]*"/)?.[0] || ''

      return `<c r="${cellRef}"${style} t="inlineStr"><is><t>${safeValue}</t></is></c>`
    })
  }

  return xml
}

const fillWorksheetLineItems = (xml, lineItems) => {
  const worksheetRows = lineItems.slice(1, 14)
  const columns = {
    stockno: 'A',
    unit: 'B',
    description: 'C',
    quantity1: 'E',
    quantity2: 'F',
    price: 'G',
    remarks: 'H'
  }

  return worksheetRows.reduce((updatedXml, item, index) => {
    const rowNumber = index + 15

    return Object.entries(columns).reduce((rowXml, [field, column]) => {
      return setWorksheetCell(rowXml, `${column}${rowNumber}`, item[field])
    }, updatedXml)
  }, xml)
}

function SheetInput({ value, onChange, type = 'text', ariaLabel }) {
  return (
    <input
      aria-label={ariaLabel}
      className="sheet-input"
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function SheetTextarea({ value, onChange, ariaLabel }) {
  return (
    <textarea
      aria-label={ariaLabel}
      className="sheet-textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows="2"
    />
  )
}

export default function RisFormPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(getInitialFormData)
  const [lineItems, setLineItems] = useState(getInitialLineItems)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [selectedTemplateName, setSelectedTemplateName] = useState(getInitialTemplateName)

  const selectedTemplate = templates.find(template => template.name === selectedTemplateName) || null

  const templateVariables = useMemo(() => {
    return {
      ...Object.fromEntries(
        Object.entries(formData).map(([key, value]) => [`{${key}}`, value])
      ),
      ...getFirstLineItemVariables(lineItems)
    }
  }, [formData, lineItems])

  useEffect(() => {
    window.localStorage.setItem(draftStorageKey, JSON.stringify({
      selectedTemplateName,
      formData,
      lineItems
    }))
  }, [selectedTemplateName, formData, lineItems])

  const handleChange = (field, value) => {
    setFormData(current => ({
      ...current,
      [field]: value
    }))
  }

  const handleLineItemChange = (index, field, value) => {
    setLineItems(current => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item

      return {
        ...item,
        [field]: value
      }
    }))
  }

  const handleAddLineItem = () => {
    setLineItems(current => {
      if (current.length >= 14) return current

      return [...current, { ...initialLineItem }]
    })
  }

  const handleRemoveLineItem = (index) => {
    setLineItems(current => {
      if (current.length === 1) return current

      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    await handleExport()
  }

  const handleReset = () => {
    window.localStorage.removeItem(draftStorageKey)
    setFormData(initialFormData)
    setLineItems([{ ...initialLineItem }])
    setSuccess('')
    setError('')
  }

  const handleSelectTemplate = (templateName) => {
    const template = templates.find(item => item.name === templateName) || null
    setSelectedTemplateName(templateName)

    if (!template) return

    setError('')
    setSuccess(`${template.name} selected.`)
  }

  const handleExport = async () => {
    if (!selectedTemplate) {
      setError('Select a form template first.')
      return
    }

    setError('')
    setSuccess('')
    setExporting(true)

    try {
      const response = await fetch(selectedTemplate.url)
      if (!response.ok) {
        throw new Error('Unable to load the selected template file.')
      }

      const zip = await JSZip.loadAsync(await response.arrayBuffer())
      const replacements = Object.entries(templateVariables)
      const xmlFiles = Object.values(zip.files).filter(file => {
        return !file.dir && file.name.toLowerCase().endsWith('.xml')
      })

      await Promise.all(xmlFiles.map(async (file) => {
        let content = await file.async('string')

        if (selectedTemplate.extension === 'xlsx' && file.name.includes('/worksheets/')) {
          content = fillWorksheetLineItems(content, lineItems)
        }

        replacements.forEach(([placeholder, value]) => {
          content = content.split(placeholder).join(escapeXml(value))
        })

        zip.file(file.name, content)
      }))

      const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: selectedTemplate.extension === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = getOutputFileName(selectedTemplate.name)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setSuccess('Filled form downloaded successfully. You can still add more items and download again.')
    } catch (err) {
      setError(err.message || 'Failed to export the filled form.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page-container ris-overlay">
      <div className="page-header">
        <div>
          <h1>RIS Form</h1>
          <p>Choose a form template before filling out the fields.</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/')}
        >
          <X size={18} /> Close
        </button>
      </div>

      <div className="card template-selector-card">
        <div className="form-group">
          <label htmlFor="template-select">Form Template</label>
          <select
            id="template-select"
            value={selectedTemplateName}
            onChange={(e) => handleSelectTemplate(e.target.value)}
            disabled={templates.length === 0}
          >
            <option value="">Select a form</option>
            {templates.map(template => (
              <option value={template.name} key={template.name}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        {selectedTemplate && (
          <div className="selected-template-row">
            <div>
              <strong>{selectedTemplate.name}</strong>
              <span>{selectedTemplate.type} .{selectedTemplate.extension}</span>
            </div>
          </div>
        )}

        {templates.length === 0 && (
          <p className="text-muted">No .xlsx or .docx templates found in assets/excel.</p>
        )}
      </div>

      {selectedTemplate && success && (
        <SuccessAlert message={success} onClose={() => setSuccess('')} />
      )}
      {selectedTemplate && error && (
        <ErrorAlert message={error} onClose={() => setError('')} />
      )}

      {selectedTemplate ? (
        <form onSubmit={handleSubmit} className="card ris-form-card ris-sheet-card">
          <div className="ris-sheet-toolbar">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAddLineItem}
              disabled={lineItems.length >= 14}
            >
              <Plus size={18} /> Add Item
            </button>
          </div>

          <div className="ris-sheet">
            <div className="ris-appendix">Appendix 63</div>
            <h2>REQUISITION AND ISSUANCE SLIP</h2>
            <p>SURIGAO DEL SUR STATE UNIVERSITY</p>
            <span>(Agency)</span>

            <table className="ris-sheet-table ris-meta-table">
              <tbody>
                <tr>
                  <th>Division</th>
                  <td>
                    <SheetInput
                      ariaLabel="Division"
                      value={formData.division}
                      onChange={(value) => handleChange('division', value)}
                    />
                  </td>
                  <th>Responsibility Center</th>
                  <th>RIS No.:</th>
                  <td>
                    <SheetInput
                      ariaLabel="RIS number"
                      value={formData.risn}
                      onChange={(value) => handleChange('risn', value)}
                    />
                  </td>
                  <th>Date:</th>
                  <td>
                    <SheetInput
                      ariaLabel="RIS date"
                      type="date"
                      value={formData.dateris}
                      onChange={(value) => handleChange('dateris', value)}
                    />
                  </td>
                  <th>Ref. Code:</th>
                  <td>
                    <SheetInput
                      ariaLabel="Reference code"
                      value={formData.rc}
                      onChange={(value) => handleChange('rc', value)}
                    />
                  </td>
                </tr>
                <tr>
                  <th>Officer</th>
                  <td>
                    <SheetInput
                      ariaLabel="Officer"
                      value={formData.officer}
                      onChange={(value) => handleChange('officer', value)}
                    />
                  </td>
                  <th>Code:</th>
                  <td>
                    <SheetInput
                      ariaLabel="Responsibility center code"
                      value={formData.code}
                      onChange={(value) => handleChange('code', value)}
                    />
                  </td>
                  <th>SAI No.:</th>
                  <td>
                    <SheetInput
                      ariaLabel="SAI number"
                      value={formData.sain}
                      onChange={(value) => handleChange('sain', value)}
                    />
                  </td>
                  <th>Date:</th>
                  <td>
                    <SheetInput
                      ariaLabel="SAI date"
                      type="date"
                      value={formData.datesai}
                      onChange={(value) => handleChange('datesai', value)}
                    />
                  </td>
                  <th>Revision:</th>
                  <td>
                    <SheetInput
                      ariaLabel="Revision"
                      value={formData.revision}
                      onChange={(value) => handleChange('revision', value)}
                    />
                  </td>
                </tr>
                <tr>
                  <th colSpan="8"></th>
                  <th>Date Effective</th>
                  <td>
                    <SheetInput
                      ariaLabel="Date effective"
                      type="date"
                      value={formData.dateeffective}
                      onChange={(value) => handleChange('dateeffective', value)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="ris-sheet-table ris-items-table">
              <thead>
                <tr>
                  <th colSpan="4">Requisition</th>
                  <th colSpan="3">Issuance</th>
                  <th></th>
                </tr>
                <tr>
                  <th>Stock No.</th>
                  <th>Unit</th>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <SheetInput
                        ariaLabel={`Stock number ${index + 1}`}
                        value={item.stockno}
                        onChange={(value) => handleLineItemChange(index, 'stockno', value)}
                      />
                    </td>
                    <td>
                      <SheetInput
                        ariaLabel={`Unit ${index + 1}`}
                        value={item.unit}
                        onChange={(value) => handleLineItemChange(index, 'unit', value)}
                      />
                    </td>
                    <td>
                      <SheetInput
                        ariaLabel={`Description ${index + 1}`}
                        value={item.description}
                        onChange={(value) => handleLineItemChange(index, 'description', value)}
                      />
                    </td>
                    <td>
                      <SheetInput
                        ariaLabel={`Requisition quantity ${index + 1}`}
                        type="number"
                        value={item.quantity1}
                        onChange={(value) => handleLineItemChange(index, 'quantity1', value)}
                      />
                    </td>
                    <td>
                      <SheetInput
                        ariaLabel={`Issuance quantity ${index + 1}`}
                        type="number"
                        value={item.quantity2}
                        onChange={(value) => handleLineItemChange(index, 'quantity2', value)}
                      />
                    </td>
                    <td>
                      <SheetInput
                        ariaLabel={`Price ${index + 1}`}
                        type="number"
                        value={item.price}
                        onChange={(value) => handleLineItemChange(index, 'price', value)}
                      />
                    </td>
                    <td>
                      <SheetInput
                        ariaLabel={`Remarks ${index + 1}`}
                        value={item.remarks}
                        onChange={(value) => handleLineItemChange(index, 'remarks', value)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-icon btn-delete"
                        onClick={() => handleRemoveLineItem(index)}
                        disabled={lineItems.length === 1}
                        aria-label="Remove item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {lineItems.length >= 14 && (
              <p className="text-muted">This template supports up to 14 item rows.</p>
            )}

            <table className="ris-sheet-table ris-purpose-table">
              <tbody>
                <tr>
                  <th>Purpose:</th>
                  <td>
                    <SheetTextarea
                      ariaLabel="Purpose"
                      value={formData.purose}
                      onChange={(value) => handleChange('purose', value)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="ris-sheet-table ris-signature-table">
              <tbody>
                <tr>
                  <th></th>
                  <th>Requested by:</th>
                  <th>Approved by:</th>
                  <th>Issued by:</th>
                  <th>Received by:</th>
                </tr>
                <tr>
                  <th>Signature</th>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
                <tr>
                  <th>Printed Name</th>
                  <td>
                    <SheetInput
                      ariaLabel={sections[0].label}
                      value={formData.requestedname}
                      onChange={(value) => handleChange('requestedname', value)}
                    />
                  </td>
                  <td>VALERIO C. SAGETARIOS, MPA</td>
                  <td>
                    <SheetInput
                      ariaLabel={sections[4].label}
                      value={formData.issuedname}
                      onChange={(value) => handleChange('issuedname', value)}
                    />
                  </td>
                  <td>
                    <SheetInput
                      ariaLabel={sections[7].label}
                      value={formData.reveivedname}
                      onChange={(value) => handleChange('reveivedname', value)}
                    />
                  </td>
                </tr>
                <tr>
                  <th>Designation</th>
                  <td>
                    <SheetInput
                      ariaLabel={sections[1].label}
                      value={formData.requesteddesignation}
                      onChange={(value) => handleChange('requesteddesignation', value)}
                    />
                  </td>
                  <td>Supply Officer III</td>
                  <td>
                    <SheetInput
                      ariaLabel={sections[5].label}
                      value={formData.issueddesignation}
                      onChange={(value) => handleChange('issueddesignation', value)}
                    />
                  </td>
                  <td>
                    <SheetInput
                      ariaLabel={sections[8].label}
                      value={formData.receiveddesignation}
                      onChange={(value) => handleChange('receiveddesignation', value)}
                    />
                  </td>
                </tr>
                <tr>
                  <th>Date</th>
                  <td>
                    <SheetInput
                      ariaLabel={sections[2].label}
                      type="date"
                      value={formData.requesteddate}
                      onChange={(value) => handleChange('requesteddate', value)}
                    />
                  </td>
                  <td>
                    <SheetInput
                      ariaLabel={sections[3].label}
                      type="date"
                      value={formData.approveddate}
                      onChange={(value) => handleChange('approveddate', value)}
                    />
                  </td>
                  <td>
                    <SheetInput
                      ariaLabel={sections[6].label}
                      type="date"
                      value={formData.issueddate}
                      onChange={(value) => handleChange('issueddate', value)}
                    />
                  </td>
                  <td>
                    <SheetInput
                      ariaLabel={sections[9].label}
                      type="date"
                      value={formData.receiveddate}
                      onChange={(value) => handleChange('receiveddate', value)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              <RotateCcw size={18} /> Reset
            </button>
            <button type="submit" className="btn btn-primary" disabled={exporting}>
              <Download size={18} /> {exporting ? 'Exporting...' : 'Download Filled Form'}
            </button>
          </div>
        </form>
      ) : (
        templates.length > 0 && (
          <div className="card empty-form-state">
            <ClipboardList size={28} />
            <p>Select a form template from the dropdown to display the form.</p>
          </div>
        )
      )}
    </div>
  )
}
