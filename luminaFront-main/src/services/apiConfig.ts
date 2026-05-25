function resolveApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL)?.trim()
  if (configured) return configured.replace(/\/$/, '')

  if (typeof window !== 'undefined' && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3000`
  }

  return 'http://127.0.0.1:3000'
}

export const API_BASE_URL = resolveApiBaseUrl()
