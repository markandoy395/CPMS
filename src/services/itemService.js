// Mock Item Service (Supabase Disabled)

let MOCK_ITEMS = [
  {
    id: '1',
    item_name: 'Dell XPS 13 Laptop',
    item_code: 'IT-LAP-001',
    description: 'High-performance laptop for development',
    category: 'IT Equipment',
    subcategory: 'Laptop',
    serial_number: 'SN123456789',
    brand: 'Dell',
    model_number: 'XPS-13-9370',
    purchase_date: '2024-01-15',
    po_number: 'PO-2024-001',
    vendor: 'Dell Computers',
    invoice_number: 'INV-2024-001',
    unit_cost: 1200,
    total_cost: 1200,
    funding_source: 'Capital Fund',
    campus: 'Main Campus',
    building: 'Admin Building',
    room_number: '301',
    department: 'IT Department',
    assigned_to: 'John Smith',
    custodian_id: '2',
    asset_type: 'Fixed Asset',
    quantity: 1,
    condition: 'Good',
    warranty_expiry: '2025-01-15',
    maintenance_schedule: 'Annual',
    insurance_policy: 'INS-2024-001',
    status: 'Active',
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    item_name: 'HP Color Printer',
    item_code: 'OFF-PRT-002',
    description: 'Multi-function color printer for office use',
    category: 'Office Equipment',
    subcategory: 'Printer',
    serial_number: 'SN987654321',
    brand: 'HP',
    model_number: 'OfficeJet Pro',
    purchase_date: '2024-01-16',
    po_number: 'PO-2024-002',
    vendor: 'Tech Supplies Inc',
    invoice_number: 'INV-2024-002',
    unit_cost: 500,
    total_cost: 1000,
    funding_source: 'Operational Budget',
    campus: 'Main Campus',
    building: 'Academic Block',
    room_number: '102',
    department: 'Administration',
    assigned_to: 'Jane Doe',
    custodian_id: null,
    asset_type: 'Fixed Asset',
    quantity: 2,
    condition: 'Good',
    warranty_expiry: '2025-01-16',
    maintenance_schedule: 'Quarterly',
    insurance_policy: 'INS-2024-002',
    status: 'Active',
    created_at: '2024-01-16T11:00:00Z'
  },
  {
    id: '3',
    item_name: 'Dell Monitor 27"',
    item_code: 'IT-MON-003',
    description: '4K UHD Display Monitor',
    category: 'IT Equipment',
    subcategory: 'Monitor',
    serial_number: 'SN555666777',
    brand: 'Dell',
    model_number: 'UltraSharp U2720Q',
    purchase_date: '2024-01-17',
    po_number: 'PO-2024-003',
    vendor: 'Dell Computers',
    invoice_number: 'INV-2024-003',
    unit_cost: 300,
    total_cost: 900,
    funding_source: 'Grant',
    campus: 'Main Campus',
    building: 'Lab Building',
    room_number: '205',
    department: 'IT Department',
    assigned_to: 'Tech Lab',
    custodian_id: '3',
    asset_type: 'Fixed Asset',
    quantity: 3,
    condition: 'Good',
    warranty_expiry: '2025-01-17',
    maintenance_schedule: 'Semi-Annual',
    insurance_policy: 'INS-2024-003',
    status: 'Active',
    created_at: '2024-01-17T09:00:00Z'
  }
]

export const itemService = {
  async getAllItems(filters = {}) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      
      let data = [...MOCK_ITEMS]
      
      if (filters.category) {
        data = data.filter(item => item.category === filters.category)
      }
      if (filters.status) {
        data = data.filter(item => item.status === filters.status)
      }
      if (filters.search) {
        data = data.filter(item => 
          item.item_name.toLowerCase().includes(filters.search.toLowerCase()) ||
          item.item_code.toLowerCase().includes(filters.search.toLowerCase())
        )
      }
      
      return { success: true, data: data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async getItemById(id) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200))
      const data = MOCK_ITEMS.find(item => item.id === id)
      return data ? { success: true, data } : { success: false, message: 'Item not found' }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async createItem(itemData) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const newItem = {
        id: Date.now().toString(),
        ...itemData,
        created_at: new Date().toISOString()
      }
      MOCK_ITEMS.push(newItem)
      return { success: true, data: newItem }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async updateItem(id, itemData) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const index = MOCK_ITEMS.findIndex(item => item.id === id)
      if (index === -1) {
        return { success: false, message: 'Item not found' }
      }
      MOCK_ITEMS[index] = { ...MOCK_ITEMS[index], ...itemData }
      return { success: true, data: MOCK_ITEMS[index] }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async deleteItem(id) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      const index = MOCK_ITEMS.findIndex(item => item.id === id)
      if (index === -1) {
        return { success: false, message: 'Item not found' }
      }
      MOCK_ITEMS.splice(index, 1)
      return { success: true }
    } catch (error) {
      return { success: false, message: error.message }
    }
  },

  async getItemStats() {
    try {
      await new Promise(resolve => setTimeout(resolve, 200))
      const totalItems = MOCK_ITEMS.length
      const totalValue = MOCK_ITEMS.reduce((sum, item) => sum + (item.total_cost || item.unit_cost * item.quantity || 0), 0)
      const activeCount = MOCK_ITEMS.filter(item => item.status === 'Active').length
      const damageCount = MOCK_ITEMS.filter(item => item.condition === 'Damaged').length
      const notDistributedCount = MOCK_ITEMS.filter(item => !item.assigned_to || item.assigned_to === '').length
      
      return {
        success: true,
        stats: {
          totalItems,
          totalValue,
          activeCount,
          damageCount,
          notDistributedCount
        }
      }
    } catch (error) {
      return { success: false, message: error.message }
    }
  }
}
