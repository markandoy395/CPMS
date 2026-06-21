import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RoleRoute({ roles, children }) {
  const { user } = useAuth()

  if (!user || (user.role !== 'Super Admin' && !roles.includes(user.role))) {
    return <Navigate to="/" replace />
  }

  return children
}
