import { apiRequest } from './apiClient'

export const authService = {
  async login(email, password) {
    const result = await apiRequest('/auth/login', { method: 'POST', body: { email, password } })
    if (result.success) {
      localStorage.setItem('cpms_token', result.token)
      localStorage.setItem('user', JSON.stringify(result.user))
    }
    return result
  },

  async logout() {
    const result = await apiRequest('/auth/logout', { method: 'POST' })
    localStorage.removeItem('cpms_token')
    localStorage.removeItem('user')
    return result.success ? result : { success: true }
  },

  async signup(email, password, name) {
    return apiRequest('/auth/signup', { method: 'POST', body: { email, password, name } })
  },

  async getCurrentUser() {
    if (!localStorage.getItem('cpms_token')) return null
    const result = await apiRequest('/auth/me')
    if (!result.success) return null
    localStorage.setItem('user', JSON.stringify(result.user))
    return result.user
  },

  async updateProfile(_userId, data) {
    const result = await apiRequest('/auth/profile', { method: 'PUT', body: data })
    if (result.success) localStorage.setItem('user', JSON.stringify(result.user))
    return result
  },

  async changePassword(currentPassword, newPassword) {
    return apiRequest('/auth/password', {
      method: 'POST',
      body: { current_password: currentPassword, new_password: newPassword }
    })
  }
}
