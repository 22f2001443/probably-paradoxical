// Thin fetch wrapper around the backend API.
// Base URL is configurable for prod (Workers) via VITE_API_BASE_URL; defaults
// to the local wrangler dev server.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'

/**
 * Send a JSON request and parse the JSON response.
 * Throws an Error (with `.status` and `.data`) on non-2xx responses.
 */
export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Could not reach the server. Please try again.')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status}).`)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

/**
 * Send multipart/form-data (for file uploads). Does NOT set content-type so the
 * browser adds the correct multipart boundary. Parses the JSON response and
 * throws (with `.status`/`.data`) on non-2xx like apiRequest.
 */
export async function apiUpload(path, formData, { token } = {}) {
  const headers = {}
  if (token) headers.authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: formData })
  } catch {
    throw new Error('Could not reach the server. Please try again.')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status}).`)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

/**
 * GET a binary response as a Blob (e.g. a PDF). Throws (with `.status`/`.data`)
 * on non-2xx, parsing the JSON error body like apiRequest.
 */
export async function apiGetBlob(path, { token } = {}) {
  const headers = {}
  if (token) headers.authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method: 'GET', headers })
  } catch {
    throw new Error('Could not reach the server. Please try again.')
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const error = new Error(data?.error || `Request failed (${response.status}).`)
    error.status = response.status
    error.data = data
    throw error
  }
  return response.blob()
}

export const apiPost = (path, body, options = {}) =>
  apiRequest(path, { ...options, method: 'POST', body })

export const apiGet = (path, options = {}) =>
  apiRequest(path, { ...options, method: 'GET' })
