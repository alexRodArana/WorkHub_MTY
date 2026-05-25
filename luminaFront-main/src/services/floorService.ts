import type { FloorSummary, SpaceWithLayout } from '../types/floor'
import type { ServiceResult } from '../types/reservation'
import { API_BASE_URL } from './apiConfig'
import { clearSession } from './tokenStore'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function unauthorizedResult(): ServiceResult<never> {
  clearSession()
  return { success: false, error: 'UNAUTHORIZED', unauthorized: true }
}

function isInvalidSessionResponse(response: Response): boolean {
  return response.status === 401 || response.status === 431
}

type CacheEntry<T> = { data: T; expiresAt: number }
const floorCache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | null {
  const entry = floorCache.get(key) as CacheEntry<T> | undefined
  if (!entry || entry.expiresAt <= Date.now()) {
    floorCache.delete(key)
    return null
  }
  return entry.data
}

function setCached<T>(key: string, data: T, ttlMs = 120000): void {
  floorCache.set(key, { data, expiresAt: Date.now() + ttlMs })
}

export async function fetchFloors(token: string): Promise<ServiceResult<FloorSummary[]>> {
  try {
    const cached = getCached<FloorSummary[]>('floors')
    if (cached) return { success: true, data: cached }
    const res = await fetch(`${API_BASE_URL}/reservations/floors`, { headers: authHeaders(token) })
    if (isInvalidSessionResponse(res)) return unauthorizedResult()
    if (!res.ok) {
      const b = await res.json()
      return { success: false, error: b.error, unauthorized: false }
    }
    const data = await res.json()
    setCached('floors', data)
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function fetchFloorSpaces(floorId: number, token: string): Promise<ServiceResult<SpaceWithLayout[]>> {
  try {
    const cacheKey = `floor:${floorId}:spaces`
    const cached = getCached<SpaceWithLayout[]>(cacheKey)
    if (cached) return { success: true, data: cached }
    const res = await fetch(`${API_BASE_URL}/reservations/floors/${floorId}/spaces`, {
      headers: authHeaders(token),
    })
    if (isInvalidSessionResponse(res)) return unauthorizedResult()
    if (!res.ok) {
      const b = await res.json()
      return { success: false, error: b.error, unauthorized: false }
    }
    const data = await res.json()
    setCached(cacheKey, data)
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}
