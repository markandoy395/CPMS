import React, { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { ClipboardList, Download, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { SuccessAlert } from '../components/SuccessAlert'
import { ErrorAlert } from '../components/ErrorAlert'
import { apiRequest } from '../services/apiClient'

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

const initialPropertyCardItem = {
  date: '',
  'reference/par_no.': '',
  qty1: '',
  qty2: '',
  'office/officer': '',
  qty3: '',
  amount: '',
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

const getInitialPropertyCardItems = () => {
  const draft = loadDraft()
  if (!Array.isArray(draft?.propertyCardItems) || draft.propertyCardItems.length === 0) {
    return [{ ...initialPropertyCardItem }]
  }

  return draft.propertyCardItems.map(item => ({
    ...initialPropertyCardItem,
    ...item,
    date: /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') ? item.date : '',
    qty1: Number.isFinite(Number(item.qty1)) && item.qty1 !== '' ? item.qty1 : '',
    qty2: Number.isFinite(Number(item.qty2)) && item.qty2 !== '' ? item.qty2 : '',
    qty3: Number.isFinite(Number(item.qty3)) && item.qty3 !== '' ? item.qty3 : '',
    amount: Number.isFinite(Number(item.amount)) && item.amount !== '' ? item.amount : ''
  }))
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

const propertyColumns = [
  { field: 'article', label: 'Article' },
  { field: 'description', label: 'Description' },
  { field: 'par_#', label: 'PAR #' },
  { field: 'property_number', label: 'Property Number' },
  { field: 'estimated_life_years', label: 'Estimated Life Years' },
  { field: 'date_of_acquisition', label: 'Date of Acquisition' },
  { field: 'unit_of_measure', label: 'Unit of Measure' },
  { field: 'unit_value', label: 'Unit Value' },
  { field: 'total_value', label: 'Total Value' },
  { field: 'salvage_value', label: 'Salvage Value' },
  { field: 'yearly_depreciation', label: 'Yearly Depreciation' },
  { field: 'accumulated_depreciation', label: 'Accumulated Depreciation' },
  { field: 'checking_computation', label: 'Checking Computation' },
  { field: 'balance_per_card', label: 'Balance per Card' },
  { field: 'balance_per_count', label: 'Balance per Count' },
  { field: 'quantity', label: 'Quantity' },
  { field: 'value', label: 'Value' },
  { field: 'condition', label: 'Condition' },
  { field: 'location', label: 'Location' },
  { field: 'end_user', label: 'End User' }
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

const fillPropertyCardLineItems = (xml, lineItems, formData) => {
  const columns = {
    date: 'B',
    'reference/par_no.': 'C',
    qty1: 'D',
    qty2: 'E',
    'office/officer': 'F',
    qty3: 'H',
    amount: 'I',
    remarks: 'J'
  }

  const updatedHeader = {
    entity_name: 'C9',
    fund_cluster: 'I9'
  }

  const xmlWithHeader = Object.entries(updatedHeader).reduce((updatedXml, [field, cell]) => {
    return setWorksheetCell(updatedXml, cell, formData[field])
  }, xml)

  return lineItems.slice(0, 10).reduce((updatedXml, item, index) => {
    const rowNumber = index + 16

    return Object.entries(columns).reduce((rowXml, [field, column]) => {
      return setWorksheetCell(rowXml, `${column}${rowNumber}`, item[field])
    }, updatedXml)
  }, xmlWithHeader)
}

const fillPropertyCountData = (xml, formData) => {
  const columns = {
    article: 'B',
    description: 'C',
    'par_#': 'D',
    property_number: 'E',
    estimated_life_years: 'F',
    date_of_acquisition: 'G',
    unit_of_measure: 'H',
    unit_value: 'I',
    total_value: 'J',
    salvage_value: 'K',
    yearly_depreciation: 'L',
    accumulated_depreciation: 'M',
    checking_computation: 'N',
    balance_per_card: 'O',
    balance_per_count: 'P',
    quantity: 'Q',
    value: 'R',
    condition: 'S',
    location: 'T',
    end_user: 'U'
  }

  return Object.entries(columns).reduce((updatedXml, [field, column]) => {
    return setWorksheetCell(updatedXml, `${column}16`, formData[field])
  }, xml)
}

const getXmlAttribute = (tag, name) => {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] || ''
}

const decodeXml = (value) => {
  return String(value)
    .replaceAll('&apos;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&')
}

const getPlaceholders = (value) => {
  return [...new Set(String(value).match(/\{[^{}]+\}/g) || [])]
}

const isFormPlaceholder = (placeholder) => {
  return !/^\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}$/i.test(placeholder)
}

const clearUnfilledPlaceholders = (value) => {
  return String(value).replace(/\{[^{}]+\}/g, placeholder => {
    return isFormPlaceholder(placeholder) ? '' : placeholder
  })
}

const formatFieldLabel = (placeholder) => {
  return placeholder
    .replace(/^\{|\}$/g, '')
    .replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, character => character.toUpperCase())
}

const getFieldType = (placeholder) => {
  return /date/i.test(placeholder) ? 'date' : /quantity|value|life|depreciation|number|item no/i.test(placeholder) ? 'number' : 'text'
}

const replacePlaceholders = (value, replacements) => {
  return replacements.reduce((updatedValue, [placeholder, replacement]) => {
    return updatedValue.split(placeholder).join(String(replacement ?? ''))
  }, value)
}

const replaceXmlPlaceholders = (value, replacements) => {
  return replacements.reduce((updatedValue, [placeholder, replacement]) => {
    return updatedValue.split(placeholder).join(escapeXml(replacement))
  }, value)
}

const getSharedStringValues = async (zip) => {
  const sharedStringsFile = zip.file('xl/sharedStrings.xml')
  if (!sharedStringsFile) return []

  const content = await sharedStringsFile.async('string')
  return [...content.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, item]) => {
    return decodeXml(item.replace(/<[^>]+>/g, ''))
  })
}

const replaceSharedStringCells = (xml, sharedStrings, replacements) => {
  return xml.replace(/<c\b([^>]*)\bt="s"([^>]*)>[\s\S]*?<v>(\d+)<\/v>[\s\S]*?<\/c>/g, (cell, beforeType, afterType, sharedIndex) => {
    const sharedString = sharedStrings[Number(sharedIndex)]
    const templatePlaceholders = getPlaceholders(sharedString).filter(isFormPlaceholder)
    if (!sharedString || templatePlaceholders.length === 0) {
      return cell
    }

    const attributes = `${beforeType}${afterType}`.replace(/\s+$/, '')
    const replacement = escapeXml(clearUnfilledPlaceholders(replacePlaceholders(sharedString, replacements)))
    return `<c${attributes} t="inlineStr"><is><t>${replacement}</t></is></c>`
  })
}

const getWorkbookSheets = async (zip) => {
  const workbookFile = zip.file('xl/workbook.xml')
  const relationshipsFile = zip.file('xl/_rels/workbook.xml.rels')
  if (!workbookFile || !relationshipsFile) return []

  const [workbookXml, relationshipsXml, sharedStrings] = await Promise.all([
    workbookFile.async('string'),
    relationshipsFile.async('string'),
    getSharedStringValues(zip)
  ])
  const relationshipTargets = new Map(
    [...relationshipsXml.matchAll(/<Relationship\b[^>]*\/>/g)].map(([tag]) => [
      getXmlAttribute(tag, 'Id'),
      getXmlAttribute(tag, 'Target')
    ])
  )
  const sheetTags = workbookXml.match(/<sheet\b[^>]*\/>/g) || []

  return Promise.all(sheetTags.map(async (tag) => {
    const relationshipId = getXmlAttribute(tag, 'r:id')
    const target = relationshipTargets.get(relationshipId) || ''
    const path = target.startsWith('xl/') ? target : `xl/${target.replace(/^\/+/, '')}`
    const worksheetFile = zip.file(path)
    const worksheetXml = worksheetFile ? await worksheetFile.async('string') : ''
    const placeholders = new Set(getPlaceholders(worksheetXml))

    for (const [, sharedIndex] of worksheetXml.matchAll(/<c\b[^>]*\bt="s"[^>]*>[\s\S]*?<v>(\d+)<\/v>[\s\S]*?<\/c>/g)) {
      getPlaceholders(sharedStrings[Number(sharedIndex)] || '').forEach(placeholder => placeholders.add(placeholder))
    }

    return {
      name: decodeXml(getXmlAttribute(tag, 'name')),
      path,
      hasContent: /<row\b/.test(worksheetXml),
      placeholders: [...placeholders].filter(isFormPlaceholder)
    }
  }))
}

function SheetInput({ value, onChange, type = 'text', ariaLabel }) {
  const normalizedValue = String(value ?? '')
  const safeValue = type === 'date' && normalizedValue && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)
    ? ''
    : type === 'number' && normalizedValue && !Number.isFinite(Number(normalizedValue))
      ? ''
      : normalizedValue

  return (
    <input
      aria-label={ariaLabel}
      className="sheet-input"
      type={type}
      value={safeValue}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function SheetTextarea({ value, onChange, ariaLabel }) {
  return (
    <textarea
      aria-label={ariaLabel}
      className="sheet-textarea"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      rows="2"
    />
  )
}

export default function RisFormPage() {
  const [formData, setFormData] = useState(getInitialFormData)
  const [lineItems, setLineItems] = useState(getInitialLineItems)
  const [propertyCardItems, setPropertyCardItems] = useState(getInitialPropertyCardItems)
  const [genericData, setGenericData] = useState(() => loadDraft()?.genericData || {})
  const [workbookSheets, setWorkbookSheets] = useState([])
  const [selectedSheetPath, setSelectedSheetPath] = useState('')
  const [loadingSheets, setLoadingSheets] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [selectedTemplateName, setSelectedTemplateName] = useState('')

  const selectedTemplate = templates.find(template => template.name === selectedTemplateName) || null
  const isRisTemplate = selectedTemplate?.name.includes('RIS-ISO')
  const isPropertyCountTemplate = selectedTemplate?.name.includes('RPCPPE')
  const isPropertyCardTemplate = selectedTemplate?.name.includes('Property Card')
  const selectedSheet = workbookSheets.find(sheet => sheet.path === selectedSheetPath) || null
  const propertyFields = new Set(
    isPropertyCountTemplate && selectedSheet?.hasContent
      ? propertyColumns.map(column => column.field)
      : selectedSheet?.placeholders.map(placeholder => placeholder.slice(1, -1)) || []
  )
  const extraPropertyFields = selectedSheet?.placeholders.filter(placeholder => {
    return !propertyColumns.some(column => column.field === placeholder.slice(1, -1))
  }) || []

  const templateVariables = useMemo(() => {
    if (isPropertyCardTemplate) {
      return {
        ...Object.fromEntries(
          Object.entries(genericData).map(([key, value]) => [`{${key}}`, value])
        ),
        ...Object.fromEntries(
          Object.entries(propertyCardItems[0] || initialPropertyCardItem).map(([key, value]) => [`{${key}}`, value])
        )
      }
    }

    if (!isRisTemplate) {
      return Object.fromEntries(
        Object.entries(genericData).map(([key, value]) => [`{${key}}`, value])
      )
    }

    return {
      ...Object.fromEntries(
        Object.entries(formData).map(([key, value]) => [`{${key}}`, value])
      ),
      ...getFirstLineItemVariables(lineItems)
    }
  }, [formData, genericData, isPropertyCardTemplate, isRisTemplate, lineItems, propertyCardItems])

  useEffect(() => {
    window.localStorage.setItem(draftStorageKey, JSON.stringify({
      selectedTemplateName,
      formData,
      lineItems,
      propertyCardItems,
      genericData
    }))
  }, [selectedTemplateName, formData, genericData, lineItems, propertyCardItems])

  useEffect(() => {
    if (!selectedTemplate || selectedTemplate.extension !== 'xlsx') {
      setWorkbookSheets([])
      setSelectedSheetPath('')
      return undefined
    }

    let isCurrent = true
    setLoadingSheets(true)
    setWorkbookSheets([])
    setSelectedSheetPath('')

    const loadWorkbookSheets = async () => {
      try {
        const response = await fetch(selectedTemplate.url)
        if (!response.ok) throw new Error('Unable to load worksheet choices.')

        const zip = await JSZip.loadAsync(await response.arrayBuffer())
        const sheets = await getWorkbookSheets(zip)
        if (!isCurrent) return

        const fillableSheets = sheets.filter(sheet => sheet.hasContent)
        setWorkbookSheets(fillableSheets)
        setSelectedSheetPath(fillableSheets[0]?.path || '')
      } catch (err) {
        if (isCurrent) setError(err.message || 'Unable to load worksheet choices.')
      } finally {
        if (isCurrent) setLoadingSheets(false)
      }
    }

    loadWorkbookSheets()
    return () => {
      isCurrent = false
    }
  }, [selectedTemplate])

  const handleChange = (field, value) => {
    setFormData(current => ({
      ...current,
      [field]: value
    }))
  }

  const handleGenericChange = (field, value) => {
    setGenericData(current => ({
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

  const handlePropertyCardItemChange = (index, field, value) => {
    setPropertyCardItems(current => current.map((item, itemIndex) => {
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
      if (current.length === 1) return [{ ...initialLineItem }]

      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  const handleAddPropertyCardItem = () => {
    setPropertyCardItems(current => {
      if (current.length >= 10) return current

      return [...current, { ...initialPropertyCardItem }]
    })
  }

  const handleRemovePropertyCardItem = (index) => {
    setPropertyCardItems(current => {
      if (current.length === 1) return [{ ...initialPropertyCardItem }]

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
    setPropertyCardItems([{ ...initialPropertyCardItem }])
    setGenericData({})
    setSuccess('')
    setError('')
  }

  const handleSelectTemplate = (templateName) => {
    const template = templates.find(item => item.name === templateName) || null
    setSelectedTemplateName(templateName)

    if (!template) return

    setError('')
    setSuccess('')
  }

  const handleCloseForm = () => {
    setSelectedTemplateName('')
    setWorkbookSheets([])
    setSelectedSheetPath('')
    setSuccess('')
    setError('')
  }

  const handleExport = async () => {
    if (!selectedTemplate) {
      setError('Select a form template first.')
      return
    }

    if (selectedTemplate.extension === 'xlsx' && !selectedSheetPath) {
      setError('Select a worksheet before downloading the form.')
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

      if (selectedTemplate.extension === 'xlsx') {
        const sharedStrings = await getSharedStringValues(zip)

        await Promise.all(xmlFiles
          .filter(file => file.name.includes('/worksheets/'))
          .map(async (file) => {
            let content = await file.async('string')
            const isSelectedSheet = file.name === selectedSheetPath
            const sheetReplacements = isSelectedSheet ? replacements : []

            if (isSelectedSheet && isRisTemplate) {
              content = fillWorksheetLineItems(content, lineItems)
            }

            if (isSelectedSheet && isPropertyCardTemplate) {
              content = fillPropertyCardLineItems(content, propertyCardItems, genericData)
            }

            if (isSelectedSheet && isPropertyCountTemplate) {
              content = fillPropertyCountData(content, genericData)
            }

            content = replaceSharedStringCells(content, sharedStrings, sheetReplacements)
            content = replaceXmlPlaceholders(content, sheetReplacements)
            zip.file(file.name, clearUnfilledPlaceholders(content))
          }))
      } else {
        await Promise.all(xmlFiles.map(async (file) => {
          const content = await file.async('string')
          zip.file(file.name, clearUnfilledPlaceholders(replaceXmlPlaceholders(content, replacements)))
        }))
      }

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

      await apiRequest('/documents', {
        method: 'POST',
        body: {
          template_name: selectedTemplate.name,
          worksheet_name: selectedSheet?.name || null,
          output_name: getOutputFileName(selectedTemplate.name),
          document_type: selectedTemplate.extension,
          metadata: { item_count: isRisTemplate ? lineItems.length : isPropertyCardTemplate ? propertyCardItems.length : 1 }
        }
      })

      setSuccess('Filled form downloaded successfully. You can continue editing and download another copy anytime.')
    } catch (err) {
      setError(err.message || 'Failed to export the filled form.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>RIS Forms</h1>
          <p>Choose a form template before filling out the fields.</p>
        </div>
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

        {templates.length === 0 && (
          <p className="text-muted">No .xlsx or .docx templates found in assets/excel.</p>
        )}
      </div>

      {selectedTemplate ? (
        <div className="ris-form-overlay" role="dialog" aria-modal="true" aria-labelledby="ris-form-title">
          <div className="ris-form-overlay-content">
            <div className="ris-form-overlay-header">
              <div>
                <h1 id="ris-form-title">{isRisTemplate ? 'RIS Form' : 'Excel Form'}</h1>
                <p>{selectedTemplate.name}</p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseForm}
              >
                <X size={18} /> Change Form
              </button>
            </div>

            {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}
            {error && <ErrorAlert message={error} onClose={() => setError('')} />}

            {loadingSheets && (
              <div className="card worksheet-loading">Loading workbook sheets...</div>
            )}

            {!loadingSheets && (
              <>
                {workbookSheets.length > 1 && (
                  <div className="worksheet-picker">
                    <div>
                      <label htmlFor="worksheet-select">Worksheet</label>
                      <select
                        id="worksheet-select"
                        value={selectedSheetPath}
                        onChange={(e) => setSelectedSheetPath(e.target.value)}
                      >
                        {workbookSheets.map(sheet => (
                          <option key={sheet.path} value={sheet.path}>{sheet.name}</option>
                        ))}
                      </select>
                    </div>
                    <span>{selectedSheet?.placeholders.length || 0} fields in this sheet</span>
                  </div>
                )}

                {isRisTemplate ? (
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
                        aria-label={lineItems.length === 1 ? 'Clear item' : 'Remove item'}
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
                ) : isPropertyCardTemplate && selectedSheet?.hasContent ? (
                  <form onSubmit={handleSubmit} className="card ris-form-card ris-sheet-card property-card-sheet-card">
                    <div className="ris-sheet-toolbar">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleAddPropertyCardItem}
                        disabled={propertyCardItems.length >= 10}
                      >
                        <Plus size={18} /> Add Item
                      </button>
                    </div>

                    <div className="property-card-sheet">
                      <div className="ris-appendix">Property Card</div>
                      <h2>PROPERTY CARD</h2>
                      <p>{selectedSheet?.name || 'Property, Plant and Equipment'}</p>
                      <span>Property transaction record</span>

                      <table className="ris-sheet-table property-card-meta-table">
                        <tbody>
                          <tr>
                            <th>Entity Name</th>
                            <td colSpan="3">
                              <SheetInput
                                ariaLabel="Entity name"
                                value={genericData.entity_name || ''}
                                onChange={(value) => handleGenericChange('entity_name', value)}
                              />
                            </td>
                            <th>Fund Cluster</th>
                            <td>
                              <SheetInput
                                ariaLabel="Fund cluster"
                                value={genericData.fund_cluster || ''}
                                onChange={(value) => handleGenericChange('fund_cluster', value)}
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      <table className="ris-sheet-table property-card-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Reference / PAR No.</th>
                            <th>Receipt Qty.</th>
                            <th>Issue / Transfer / Disposal Qty.</th>
                            <th>Office / Officer</th>
                            <th>Balance Qty.</th>
                            <th>Amount</th>
                            <th>Remarks</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {propertyCardItems.map((item, index) => (
                            <tr key={index}>
                              <td>
                                <SheetInput
                                  ariaLabel={`Date ${index + 1}`}
                                  type="date"
                                  value={item.date}
                                  onChange={(value) => handlePropertyCardItemChange(index, 'date', value)}
                                />
                              </td>
                              <td>
                                <SheetInput
                                  ariaLabel={`Reference or PAR number ${index + 1}`}
                                  value={item['reference/par_no.']}
                                  onChange={(value) => handlePropertyCardItemChange(index, 'reference/par_no.', value)}
                                />
                              </td>
                              <td>
                                <SheetInput
                                  ariaLabel={`Receipt quantity ${index + 1}`}
                                  type="number"
                                  value={item.qty1}
                                  onChange={(value) => handlePropertyCardItemChange(index, 'qty1', value)}
                                />
                              </td>
                              <td>
                                <SheetInput
                                  ariaLabel={`Issue transfer or disposal quantity ${index + 1}`}
                                  type="number"
                                  value={item.qty2}
                                  onChange={(value) => handlePropertyCardItemChange(index, 'qty2', value)}
                                />
                              </td>
                              <td>
                                <SheetInput
                                  ariaLabel={`Office or officer ${index + 1}`}
                                  value={item['office/officer']}
                                  onChange={(value) => handlePropertyCardItemChange(index, 'office/officer', value)}
                                />
                              </td>
                              <td>
                                <SheetInput
                                  ariaLabel={`Balance quantity ${index + 1}`}
                                  type="number"
                                  value={item.qty3}
                                  onChange={(value) => handlePropertyCardItemChange(index, 'qty3', value)}
                                />
                              </td>
                              <td>
                                <SheetInput
                                  ariaLabel={`Amount ${index + 1}`}
                                  type="number"
                                  value={item.amount}
                                  onChange={(value) => handlePropertyCardItemChange(index, 'amount', value)}
                                />
                              </td>
                              <td>
                                <SheetInput
                                  ariaLabel={`Remarks ${index + 1}`}
                                  value={item.remarks}
                                  onChange={(value) => handlePropertyCardItemChange(index, 'remarks', value)}
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn-icon btn-delete"
                                  onClick={() => handleRemovePropertyCardItem(index)}
                                  aria-label={propertyCardItems.length === 1
                                    ? 'Clear item'
                                    : `Remove item ${index + 1}`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {propertyCardItems.length >= 10 && (
                        <p className="text-muted">This template supports up to 10 transaction rows.</p>
                      )}
                    </div>

                    <div className="form-actions">
                      <button type="button" className="btn btn-secondary" onClick={handleReset}>
                        <RotateCcw size={18} /> Reset
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={exporting || !selectedSheet}>
                        <Download size={18} /> {exporting ? 'Exporting...' : 'Download Filled Form'}
                      </button>
                    </div>
                  </form>
                ) : isPropertyCountTemplate ? (
                  <form onSubmit={handleSubmit} className="card ris-form-card ris-sheet-card rpcppe-sheet-card">
                    <div className="rpcppe-sheet">
                      <div className="ris-appendix">Report on Physical Count of Property, Plant and Equipment</div>
                      <h2>REPORT ON THE PHYSICAL COUNT OF PROPERTY, PLANT AND EQUIPMENT</h2>
                      <p>{selectedSheet?.name || 'Property, Plant and Equipment'}</p>
                      <span>Selected worksheet</span>

                      <table className="ris-sheet-table rpcppe-table">
                        <thead>
                          <tr>
                            {propertyColumns.slice(0, 15).map(column => (
                              <th rowSpan="2" key={column.field}>{column.label}</th>
                            ))}
                            <th colSpan="2">Shortage / Overage</th>
                            <th colSpan="3">Remarks</th>
                          </tr>
                          <tr>
                            {propertyColumns.slice(15).map(column => (
                              <th key={column.field}>{column.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {propertyColumns.map(column => (
                              <td key={column.field}>
                                {propertyFields.has(column.field) ? (
                                  <SheetInput
                                    ariaLabel={column.label}
                                    type={getFieldType(`{${column.field}}`)}
                                    value={genericData[column.field] || ''}
                                    onChange={(value) => handleGenericChange(column.field, value)}
                                  />
                                ) : <span className="rpcppe-empty-cell">-</span>}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>

                      {extraPropertyFields.length > 0 && (
                        <div className="rpcppe-extra-fields">
                          {extraPropertyFields.map(placeholder => {
                            const field = placeholder.slice(1, -1)
                            return (
                              <div className="form-group" key={placeholder}>
                                <label htmlFor={`field-${field}`}>{formatFieldLabel(placeholder)}</label>
                                <input
                                  id={`field-${field}`}
                                  type={getFieldType(placeholder)}
                                  value={genericData[field] || ''}
                                  onChange={(e) => handleGenericChange(field, e.target.value)}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="form-actions">
                      <button type="button" className="btn btn-secondary" onClick={handleReset}>
                        <RotateCcw size={18} /> Reset
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={exporting || !selectedSheet}>
                        <Download size={18} /> {exporting ? 'Exporting...' : 'Download Filled Form'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleSubmit} className="card generic-template-form">
                    <div className="generic-form-header">
                      <div>
                        <h2>{selectedSheet?.name || 'Worksheet'}</h2>
                        <p>Enter the details for the selected worksheet.</p>
                      </div>
                    </div>

                    {selectedSheet?.placeholders.length ? (
                      <div className="generic-fields-grid">
                        {selectedSheet.placeholders.map(placeholder => {
                          const field = placeholder.slice(1, -1)
                          const type = getFieldType(placeholder)

                          return (
                            <div className="form-group" key={placeholder}>
                              <label htmlFor={`field-${field}`}>{formatFieldLabel(placeholder)}</label>
                              <input
                                id={`field-${field}`}
                                type={type}
                                value={genericData[field] || ''}
                                onChange={(e) => handleGenericChange(field, e.target.value)}
                              />
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-muted">This worksheet does not contain fillable template variables.</p>
                    )}

                    <div className="form-actions">
                      <button type="button" className="btn btn-secondary" onClick={handleReset}>
                        <RotateCcw size={18} /> Reset
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={exporting || !selectedSheet}>
                        <Download size={18} /> {exporting ? 'Exporting...' : 'Download Filled Form'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
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
