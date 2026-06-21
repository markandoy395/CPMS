import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react'

const toastTypes = {
  success: { title: 'Success', icon: CheckCircle },
  error: { title: 'Action failed', icon: AlertCircle },
  warning: { title: 'Attention needed', icon: AlertTriangle },
  info: { title: 'Information', icon: Info }
}

function getToastViewport() {
  let viewport = document.getElementById('notification-toast-viewport')
  if (!viewport) {
    viewport = document.createElement('div')
    viewport.id = 'notification-toast-viewport'
    viewport.className = 'notification-toast-viewport'
    viewport.setAttribute('aria-live', 'polite')
    document.body.appendChild(viewport)
  }
  return viewport
}

export function NotificationToast({ message, onClose, type = 'info', duration }) {
  const onCloseRef = useRef(onClose)
  const config = toastTypes[type] || toastTypes.info
  const Icon = config.icon
  const timeout = duration ?? (type === 'error' ? 8000 : 5000)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!timeout) return undefined
    const timer = window.setTimeout(() => onCloseRef.current?.(), timeout)
    return () => window.clearTimeout(timer)
  }, [timeout])

  return createPortal(
    <div className={`notification-toast notification-toast-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <div className="notification-toast-icon" aria-hidden="true"><Icon size={21} /></div>
      <div className="notification-toast-message">
        <strong>{config.title}</strong>
        <p>{message}</p>
      </div>
      <button type="button" className="notification-toast-close" onClick={onClose} aria-label="Dismiss notification">
        <X size={17} />
      </button>
      {timeout > 0 && <span className="notification-toast-progress" style={{ animationDuration: `${timeout}ms` }} />}
    </div>,
    getToastViewport()
  )
}

export function WarningAlert(props) {
  return <NotificationToast {...props} type="warning" />
}

export function InfoAlert(props) {
  return <NotificationToast {...props} type="info" />
}
