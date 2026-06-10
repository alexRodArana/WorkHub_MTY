const PRODUCTION_API_URL = 'https://workhub-mty.onrender.com'

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
}

function resolveApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL)?.trim()
  if (configured) return configured.replace(/\/$/, '')

  if (typeof window !== 'undefined' && window.location.hostname) {
    if (!isLocalHost(window.location.hostname)) return PRODUCTION_API_URL
    return `${window.location.protocol}//${window.location.hostname}:3000`
  }

  return 'http://127.0.0.1:3000'
}

export const API_BASE_URL = resolveApiBaseUrl()
