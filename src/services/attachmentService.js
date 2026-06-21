import { apiBlob, apiRequest, apiUpload } from './apiClient'

export const attachmentService = {
  getForItem(itemId) {
    return apiRequest('/attachments', { query: { item_id: itemId } })
  },
  upload(itemId, file) {
    const formData = new FormData()
    formData.append('item_id', itemId)
    formData.append('file', file)
    return apiUpload('/attachments', formData)
  },
  delete(id) {
    return apiRequest(`/attachments/${id}`, { method: 'DELETE' })
  },
  getContent(id) {
    return apiBlob(`/attachments/${id}/content`)
  }
}
