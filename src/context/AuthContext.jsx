import React, { createContext, useState, useEffect, useCallback } from 'react'
import { authService } from '../services/authService'

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser()
        setUser(currentUser)
      } catch (err) {
        console.error('Auth check error:', err)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = useCallback(async (email, password) => {
    setError(null)
    const result = await authService.login(email, password)
    if (result.success) {
      setUser(result.user)
    } else {
      setError(result.message)
    }
    return result
  }, [])

  const logout = useCallback(async () => {
    setError(null)
    const result = await authService.logout()
    if (result.success) {
      setUser(null)
    } else {
      setError(result.message)
    }
    return result
  }, [])

  const signup = useCallback(async (email, password, name, role) => {
    setError(null)
    const result = await authService.signup(email, password, name, role)
    if (result.success) {
      setUser(result.user)
    } else {
      setError(result.message)
    }
    return result
  }, [])

  const updateProfile = useCallback(async (userId, data) => {
    setError(null)
    const result = await authService.updateProfile(userId, data)
    if (result.success) {
      setUser(result.user)
    } else {
      setError(result.message)
    }
    return result
  }, [])

  const changePassword = useCallback(async (newPassword) => {
    setError(null)
    const result = await authService.changePassword(newPassword)
    if (!result.success) {
      setError(result.message)
    }
    return result
  }, [])

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    signup,
    updateProfile,
    changePassword,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
