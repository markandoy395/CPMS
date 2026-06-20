import React, { useEffect } from 'react'
import { X, CheckCircle } from 'lucide-react'

export function SuccessAlert({ message, onClose, duration = 5000 }) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  return (
    <div className="alert alert-success">
      <div className="alert-content">
        <CheckCircle size={20} />
        <p>{message}</p>
      </div>
      <button className="alert-close" onClick={onClose}>
        <X size={18} />
      </button>
    </div>
  )
}
