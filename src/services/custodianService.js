// Mock Custodian Service (Supabase Disabled)

let MOCK_CUSTODIANS = [
  {
    id: '2',
    user_id: '2',
    department: 'IT',
    position: 'IT Manager',
    contact_number: '555-0001',
    status: 'Active',
    total_items: 5,
    items_good_condition: 5,
    items_fair_condition: 0,
    items_poor_condition: 0,
    pending_maintenance: 1,
    warranty_expiring_soon: 2,
    created_at: '2024-01-15T10:00:00Z',
    last_verification: '2025-02-28T14:30:00Z',
    users: { id: '2', name: 'Custodian Test', email: 'custodian@example.com' }
  },
  {
    id: '3',
    user_id: '3',
    department: 'Finance',
    position: 'Finance Director',
    contact_number: '555-0002',
    status: 'Active',
    total_items: 3,
    items_good_condition: 3,
    items_fair_condition: 0,
    items_poor_condition: 0,
    pending_maintenance: 0,
    warranty_expiring_soon: 1,
    created_at: '2024-01-16T11:00:00Z',
    last_verification: '2025-03-01T10:15:00Z',
    users: { id: '3', name: 'Auditor User', email: 'auditor@example.com' }
  }
]

let MOCK_MAINTENANCE = [
  {
    id: 'm1',
    custodian_id: '2',
    item_id: '1',
    maintenance_type: 'Software Update',
    scheduled_date: '2025-03-15',
    status: 'Pending',
    created_at: '2025-03-01T10:00:00Z'
  }
]

let MOCK_ITEM_TRANSFERS = [
  {
    id: 't1',
    item_id: '1',
    from_custodian_id: '3',
    to_custodian_id: '2',
    transfer_date: '2025-02-01T09:00:00Z',
    reason: 'Departmental Reorganization',
    status: 'Completed',
    created_at: '2025-02-01T08:00:00Z'
  }
]

let MOCK_INVENTORY_VERIFICATION = [
  {
    id: 'v1',
    custodian_id: '2',
    verification_date: '2025-02-28T14:30:00Z',
    total_items_expected: 5,
    items_found: 5,
    items_missing: 0,
    discrepancies: [],
    status: 'Completed',
    verified_by: 'Admin User'
  }
]

export const custodianService = {
  async getAllCustodians(filters = {}) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      
      let data = [...MOCK_CUSTODIANS]
      
      if (filters.status) {
        data = data.filter(c => c.status === filters.status)
      }
      if (filters.department) {
        data = data.filter(c => c.department === filters.department)
      }
      if (filters.search) {
        data = data.filter(c => 
          c.users.name.toLowerCase().includes(filters.search.toLowerCase())
        )
      }
      
      return { success: true, data: data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async getCustodianById(id) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200))
      const data = MOCK_CUSTODIANS.find(c => c.id === id)
      return data ? { success: true, data } : { success: false, message: 'Custodian not found' }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async createCustodian(custodianData) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const newCustodian = {
        id: Date.now().toString(),
        ...custodianData,
        created_at: new Date().toISOString(),
        users: { id: custodianData.user_id, name: 'New Custodian', email: 'new@example.com' }
      }
      MOCK_CUSTODIANS.push(newCustodian)
      return { success: true, data: newCustodian }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async updateCustodian(id, custodianData) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const index = MOCK_CUSTODIANS.findIndex(c => c.id === id)
      if (index === -1) {
        return { success: false, message: 'Custodian not found' }
      }
      MOCK_CUSTODIANS[index] = { ...MOCK_CUSTODIANS[index], ...custodianData }
      return { success: true, data: MOCK_CUSTODIANS[index] }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async deleteCustodian(id) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const index = MOCK_CUSTODIANS.findIndex(c => c.id === id)
      if (index === -1) {
        return { success: false, message: 'Custodian not found' }
      }
      MOCK_CUSTODIANS.splice(index, 1)
      return { success: true }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async getCustodianStats() {
    try {
      await new Promise(resolve => setTimeout(resolve, 200))
      const totalCustodians = MOCK_CUSTODIANS.length
      const activeCustodians = MOCK_CUSTODIANS.filter(c => c.status === 'Active').length
      
      return {
        success: true,
        stats: {
          totalCustodians,
          activeCustodians,
          inactiveCustodians: totalCustodians - activeCustodians
        }
      }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  // ===== IMPORTANT CUSTODIAN FEATURES =====

  /**
   * Get all items assigned to a custodian
   */
  async getCustodianItems(custodianId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const items = [
        { id: '1', item_name: 'Dell XPS Laptop', item_code: 'IT-LAP-001', status: 'Active', condition: 'Good' },
        { id: '2', item_name: 'Office Chair', item_code: 'OFF-CHAIR-001', status: 'Active', condition: 'Good' }
      ]
      return { success: true, data: items }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Get custodian dashboard with key metrics and alerts
   */
  async getCustodianDashboard(custodianId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const custodian = MOCK_CUSTODIANS.find(c => c.id === custodianId)
      if (!custodian) {
        return { success: false, message: 'Custodian not found' }
      }
      
      return {
        success: true,
        data: {
          custodian_id: custodianId,
          total_items: custodian.total_items,
          items_by_condition: {
            good: custodian.items_good_condition,
            fair: custodian.items_fair_condition,
            poor: custodian.items_poor_condition
          },
          pending_maintenance: custodian.pending_maintenance,
          warranty_expiring_soon: custodian.warranty_expiring_soon,
          last_verification: custodian.last_verification,
          alerts: {
            maintenance_due: custodian.pending_maintenance > 0,
            warranty_expiring: custodian.warranty_expiring_soon > 0,
            verification_overdue: this._isVerificationOverdue(custodian.last_verification)
          }
        }
      }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Schedule maintenance for an item
   */
  async scheduleMaintenance(custodianId, itemId, maintenanceData) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const maintenance = {
        id: `m${Date.now()}`,
        custodian_id: custodianId,
        item_id: itemId,
        ...maintenanceData,
        status: 'Pending',
        created_at: new Date().toISOString()
      }
      MOCK_MAINTENANCE.push(maintenance)
      return { success: true, data: maintenance }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Get all maintenance records for a custodian
   */
  async getMaintenanceRecords(custodianId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const records = MOCK_MAINTENANCE.filter(m => m.custodian_id === custodianId)
      return { success: true, data: records }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Update maintenance status
   */
  async updateMaintenanceStatus(maintenanceId, status) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const maintenance = MOCK_MAINTENANCE.find(m => m.id === maintenanceId)
      if (!maintenance) {
        return { success: false, message: 'Maintenance record not found' }
      }
      maintenance.status = status
      return { success: true, data: maintenance }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Transfer item to another custodian
   */
  async transferItem(itemId, fromCustodianId, toCustodianId, reason) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const transfer = {
        id: `t${Date.now()}`,
        item_id: itemId,
        from_custodian_id: fromCustodianId,
        to_custodian_id: toCustodianId,
        transfer_date: new Date().toISOString(),
        reason: reason,
        status: 'Completed',
        created_at: new Date().toISOString()
      }
      MOCK_ITEM_TRANSFERS.push(transfer)
      
      // Update custodian counts
      const fromCust = MOCK_CUSTODIANS.find(c => c.id === fromCustodianId)
      const toCust = MOCK_CUSTODIANS.find(c => c.id === toCustodianId)
      if (fromCust) fromCust.total_items--
      if (toCust) toCust.total_items++
      
      return { success: true, data: transfer }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Get transfer history for custodian
   */
  async getTransferHistory(custodianId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const transfers = MOCK_ITEM_TRANSFERS.filter(
        t => t.from_custodian_id === custodianId || t.to_custodian_id === custodianId
      )
      return { success: true, data: transfers }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Perform inventory verification/count
   */
  async performInventoryVerification(custodianId, verificationData) {
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      const custodian = MOCK_CUSTODIANS.find(c => c.id === custodianId)
      if (!custodian) {
        return { success: false, message: 'Custodian not found' }
      }

      const verification = {
        id: `v${Date.now()}`,
        custodian_id: custodianId,
        verification_date: new Date().toISOString(),
        total_items_expected: verificationData.total_items_expected,
        items_found: verificationData.items_found,
        items_missing: verificationData.items_missing,
        discrepancies: verificationData.discrepancies || [],
        status: 'Completed',
        verified_by: verificationData.verified_by
      }
      MOCK_INVENTORY_VERIFICATION.push(verification)
      
      // Update custodian last verification date
      custodian.last_verification = new Date().toISOString()
      
      return { success: true, data: verification }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Get inventory verification history
   */
  async getVerificationHistory(custodianId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const verifications = MOCK_INVENTORY_VERIFICATION.filter(v => v.custodian_id === custodianId)
      return { success: true, data: verifications }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Get custodian alerts (warranty, maintenance, verification)
   */
  async getCustodianAlerts(custodianId) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const custodian = MOCK_CUSTODIANS.find(c => c.id === custodianId)
      if (!custodian) {
        return { success: false, message: 'Custodian not found' }
      }

      const alerts = []
      
      if (custodian.pending_maintenance > 0) {
        alerts.push({
          type: 'maintenance',
          severity: 'warning',
          message: `${custodian.pending_maintenance} item(s) require maintenance`,
          count: custodian.pending_maintenance
        })
      }
      
      if (custodian.warranty_expiring_soon > 0) {
        alerts.push({
          type: 'warranty',
          severity: 'info',
          message: `${custodian.warranty_expiring_soon} item(s) have warranty expiring soon`,
          count: custodian.warranty_expiring_soon
        })
      }
      
      if (custodian.items_poor_condition > 0) {
        alerts.push({
          type: 'condition',
          severity: 'danger',
          message: `${custodian.items_poor_condition} item(s) in poor condition`,
          count: custodian.items_poor_condition
        })
      }
      
      if (this._isVerificationOverdue(custodian.last_verification)) {
        alerts.push({
          type: 'verification',
          severity: 'warning',
          message: 'Inventory verification is overdue',
          last_verified: custodian.last_verification
        })
      }
      
      return { success: true, data: alerts }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  /**
   * Generate custodian report
   */
  async generateCustodianReport(custodianId, reportType = 'summary') {
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      const custodian = MOCK_CUSTODIANS.find(c => c.id === custodianId)
      if (!custodian) {
        return { success: false, message: 'Custodian not found' }
      }

      const report = {
        report_id: `rpt${Date.now()}`,
        custodian_id: custodianId,
        custodian_name: custodian.users.name,
        department: custodian.department,
        report_type: reportType,
        generated_at: new Date().toISOString(),
        summary: {
          total_items: custodian.total_items,
          items_good: custodian.items_good_condition,
          items_fair: custodian.items_fair_condition,
          items_poor: custodian.items_poor_condition,
          pending_maintenance: custodian.pending_maintenance,
          warranty_expiring_soon: custodian.warranty_expiring_soon
        }
      }
      
      return { success: true, data: report }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  // Helper methods
  _isVerificationOverdue(lastVerificationDate) {
    if (!lastVerificationDate) return true
    const lastVerification = new Date(lastVerificationDate)
    const now = new Date()
    const days = Math.floor((now - lastVerification) / (1000 * 60 * 60 * 24))
    return days > 90 // Verification overdue if more than 90 days
  }
}
