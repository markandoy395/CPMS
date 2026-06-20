import React from 'react'
import { X, AlertCircle } from 'lucide-react'

export function ErrorAlert({ message, onClose }) {
  return (
    <div className="alert alert-error">
      <div className="alert-content">
        <AlertCircle size={20} />
        <p>{message}</p>
      </div>
      <button className="alert-close" onClick={onClose}>
        <X size={18} />
      </button>
    </div>
  )
}
