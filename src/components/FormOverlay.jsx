import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export function FormOverlay({ title, description, onClose, children, size = 'medium' }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <div
      className="system-form-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={`system-form-dialog system-form-dialog-${size}`}>
        <div className="system-form-header">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label={`Close ${title}`}>
            <X size={20} />
          </button>
        </div>
        <div className="system-form-content">{children}</div>
      </div>
    </div>
  )
}
