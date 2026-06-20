// Mock Authentication Service (Supabase Disabled)

import { MOCK_USERS } from './mockData.js'

export const authService = {
  async login(email, password) {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const user = MOCK_USERS.find(u => u.email === email)
      
      if (!user || user.password !== password) {
        return {
          success: false,
          message: 'Invalid email or password'
        }
      }

      const userData = { ...user }
      delete userData.password
      
      // Store in localStorage
      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('token', `token_${user.id}`)
      
      return {
        success: true,
        user: userData
      }
    } catch (error) {
      return {
        success: false,
        message: error.message
      }
    }
  },

  async logout() {
    try {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
      return { success: true }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async signup(email, password, name, role = 'Custodian') {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Check if user already exists
      if (MOCK_USERS.find(u => u.email === email)) {
        return {
          success: false,
          message: 'Email already registered'
        }
      }

      const newUser = {
        id: Date.now().toString(),
        name,
        email,
        password,
        role,
        status: 'Active'
      }

      // Add to mock users
      MOCK_USERS.push(newUser)

      const userData = { ...newUser }
      delete userData.password
      
      // Store in localStorage
      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('token', `token_${newUser.id}`)
      
      return {
        success: true,
        user: userData
      }
    } catch (error) {
      return {
        success: false,
        message: error.message
      }
    }
  },

  async getCurrentUser() {
    try {
      const user = localStorage.getItem('user')
      return user ? JSON.parse(user) : null
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  },

  async updateProfile(userId, { name, email }) {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const user = MOCK_USERS.find(u => u.id === userId)
      if (!user) {
        return { success: false, message: 'User not found' }
      }

      user.name = name
      user.email = email

      const userData = { ...user }
      delete userData.password
      
      localStorage.setItem('user', JSON.stringify(userData))
      
      return { success: true, user: userData }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async changePassword(newPassword) {
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const currentUser = await this.getCurrentUser()
      if (!currentUser) {
        return { success: false, message: 'User not authenticated' }
      }

      const user = MOCK_USERS.find(u => u.id === currentUser.id)
      if (user) {
        user.password = newPassword
      }

      return { success: true }
    } catch (error) {
      return { success: false, message: error.message }
    }
  }
}
