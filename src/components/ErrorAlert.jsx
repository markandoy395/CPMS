import React from 'react'
import { NotificationToast } from './NotificationToast'

export function ErrorAlert({ message, onClose, duration = 8000 }) {
  return <NotificationToast message={message} onClose={onClose} type="error" duration={duration} />
}
