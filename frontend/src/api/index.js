import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('blog_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Collection endpoints return the shared envelope
//   { success: true, data: [...], meta: {...} }
// while single-resource endpoints return the bare object. Flatten the
// envelope back onto `response.data` (meta fields plus the resource key the
// views already read: `articles` / `tags`) so existing views keep working
// unchanged against the new response contract.
api.interceptors.response.use((response) => {
  const body = response.data
  if (body && body.success === true && Array.isArray(body.data)) {
    const path = (response.config.url || '').split('?')[0]
    const key = path.endsWith('/tags') ? 'tags' : 'articles'
    response.data = { ...body.meta, [key]: body.data }
  }
  return response
}, (error) => {
  if (error.response?.status === 401) {
    localStorage.removeItem('blog_token')
    localStorage.removeItem('blog_username')
    // Optionally redirect to login
  }
  return Promise.reject(error)
})

export default api
