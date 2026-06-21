import React from 'react'
import { NotificationToast } from './NotificationToast'

export function SuccessAlert({ message, onClose, duration = 5000 }) {
  return <NotificationToast message={message} onClose={onClose} type="success" duration={duration} />
}
