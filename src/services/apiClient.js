const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export async function apiRequest(path, options = {}) {
  const token = window.localStorage.getItem('cpms_token')
  const query = options.query
    ? `?${new URLSearchParams(Object.entries(options.query).filter(([, value]) => value !== '' && value != null))}`
    : ''

  try {
    const response = await fetch(`${API_URL}${path}${query}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    })

    const payload = await response.json().catch(() => ({
      success: false,
      message: 'The server returned an invalid response.'
    }))

    if (response.status === 401) {
      window.localStorage.removeItem('cpms_token')
      window.localStorage.removeItem('user')
    }

    return response.ok ? payload : {
      success: false,
      message: payload.message || `Request failed (${response.status})`
    }
  } catch {
    return {
      success: false,
      message: 'Cannot connect to the CPMS API. Start XAMPP MySQL and the PHP API server.'
    }
  }
}

export async function apiUpload(path, formData) {
  const token = window.localStorage.getItem('cpms_token')
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    })
    const payload = await response.json()
    return response.ok ? payload : { success: false, message: payload.message || 'Upload failed' }
  } catch {
    return { success: false, message: 'Cannot connect to the attachment service.' }
  }
}

export async function apiBlob(path) {
  const token = window.localStorage.getItem('cpms_token')
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!response.ok) throw new Error('Unable to load attachment')
  return response.blob()
}
