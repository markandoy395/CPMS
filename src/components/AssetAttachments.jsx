import React, { useEffect, useState } from 'react'
import { Download, FileText, Image, Paperclip, Trash2, Upload, X } from 'lucide-react'
import { attachmentService } from '../services/attachmentService'
import { useAuth } from '../context/AuthContext'
import { ErrorAlert } from './ErrorAlert'
import { SuccessAlert } from './SuccessAlert'

function PhotoPreview({ attachment }) {
  const [source, setSource] = useState('')

  useEffect(() => {
    let url = ''
    attachmentService.getContent(attachment.id).then(blob => {
      url = URL.createObjectURL(blob)
      setSource(url)
    }).catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [attachment.id])

  return source ? <img src={source} alt={attachment.original_name} /> : <Image size={24} />
}

export function AssetAttachments({ item, onClose }) {
  const { user } = useAuth()
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadAttachments = async () => {
    const result = await attachmentService.getForItem(item.id)
    if (result.success) setAttachments(result.data)
    else setError(result.message)
  }

  useEffect(() => { loadAttachments() }, [item.id])

  const upload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const result = await attachmentService.upload(item.id, file)
    if (result.success) {
      await loadAttachments()
      setSuccess('Attachment uploaded successfully.')
    }
    else setError(result.message)
    setUploading(false)
    event.target.value = ''
  }

  const download = async (attachment) => {
    try {
      const blob = await attachmentService.getContent(attachment.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.original_name
      link.click()
      URL.revokeObjectURL(url)
      setSuccess('Attachment download started.')
    } catch {
      setError('Unable to download the attachment.')
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this attachment?')) return
    const result = await attachmentService.delete(id)
    if (result.success) {
      loadAttachments()
      setSuccess('Attachment deleted successfully.')
    }
    else setError(result.message)
  }

  return (
    <div className="asset-tool-overlay" role="dialog" aria-modal="true" aria-label="Asset photos and files">
      <div className="asset-tool-dialog attachments-dialog">
        <div className="asset-tool-header">
          <div><h2>Photos & Files</h2><p>{item.item_code} - {item.item_name}</p></div>
          <button className="btn-icon" onClick={onClose} aria-label="Close attachments"><X size={20} /></button>
        </div>
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}
        {success && <SuccessAlert message={success} onClose={() => setSuccess('')} />}
        {['Admin', 'Custodian'].includes(user?.role) && (
          <label className={`btn btn-primary attachment-upload ${uploading ? 'disabled' : ''}`}>
            <Upload size={18} /> {uploading ? 'Uploading...' : 'Upload Photo or File'}
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx,.txt" onChange={upload} disabled={uploading} />
          </label>
        )}
        <div className="attachment-grid">
          {attachments.map(attachment => (
            <div className="attachment-item" key={attachment.id}>
              <div className="attachment-preview">
                {attachment.attachment_type === 'Photo' ? <PhotoPreview attachment={attachment} /> : <FileText size={28} />}
              </div>
              <div className="attachment-info">
                <strong>{attachment.original_name}</strong>
                <span>{Math.ceil(attachment.file_size / 1024)} KB - {attachment.attachment_type}</span>
              </div>
              <div className="attachment-actions">
                <button className="btn-icon" onClick={() => download(attachment)} aria-label="Download attachment"><Download size={16} /></button>
                {user?.role === 'Admin' && <button className="btn-icon btn-delete" onClick={() => remove(attachment.id)} aria-label="Delete attachment"><Trash2 size={16} /></button>}
              </div>
            </div>
          ))}
          {attachments.length === 0 && <div className="empty-attachments"><Paperclip size={28} /><p>No photos or files attached.</p></div>}
        </div>
      </div>
    </div>
  )
}
