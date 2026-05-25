import type {
  FilterValues,
  SpaceAvailability,
  ReservationRequest,
  ReservationResponse,
  RecommendationResult,
  AssistantResponse,
  ReservationRealtimeEvent,
  AdminKpiOverview,
  AreaBlock,
  SpaceBlock,
  ParkingReservationForGuard,
  SpaceOccupancy,
  UserReservation,
  UserSearchResult,
  UserVehicle,
  AuditLogEntry,
  ApiErrorResponse,
  ServiceResult,
} from '../types/reservation'
import type { CheckInPayload } from '../types/gamification'
import { API_BASE_URL } from './apiConfig'
import { clearSession } from './tokenStore'

function unauthorizedResult(): ServiceResult<never> {
  clearSession()
  return { success: false, error: 'UNAUTHORIZED', unauthorized: true }
}

function isInvalidSessionResponse(response: Response): boolean {
  return response.status === 401 || response.status === 431
}

type CacheEntry<T> = {
  data: T
  expiresAt: number
}

const responseCache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | null {
  const entry = responseCache.get(key) as CacheEntry<T> | undefined
  if (!entry || entry.expiresAt <= Date.now()) {
    responseCache.delete(key)
    return null
  }
  return entry.data
}

function setCached<T>(key: string, data: T, ttlMs = 15000): void {
  responseCache.set(key, { data, expiresAt: Date.now() + ttlMs })
}

function scopedCacheKey(token: string, key: string): string {
  return `${token.slice(-16)}:${key}`
}

export function clearReservationCache(): void {
  responseCache.clear()
}

export async function fetchAvailability(
  filters: FilterValues,
  token: string
): Promise<ServiceResult<SpaceAvailability[]>> {
  try {
    const params = new URLSearchParams({
      reservation_date: filters.reservation_date,
      start_time: filters.start_time,
      end_time: filters.end_time,
    });

    if (filters.floor_id !== null) {
      params.append('floor_id', String(filters.floor_id));
    }

    if (filters.priority_category !== null) {
      params.append('priority_category', filters.priority_category);
    }

    const cacheKey = scopedCacheKey(token, `availability:${params.toString()}`)
    const cached = getCached<SpaceAvailability[]>(cacheKey)
    if (cached) return { success: true, data: cached }

    const response = await fetch(`${API_BASE_URL}/reservations/availability?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (isInvalidSessionResponse(response)) return unauthorizedResult()

    if (!response.ok) {
      const body: ApiErrorResponse = await response.json();
      return { success: false, error: body.error, unauthorized: false };
    }

    const data: SpaceAvailability[] = await response.json();
    setCached(cacheKey, data, 8000)
    return { success: true, data };
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false };
  }
}

export async function fetchFloorOccupancy(
  floorId: number,
  reservationDate: string,
  token: string
): Promise<ServiceResult<SpaceOccupancy[]>> {
  try {
    const params = new URLSearchParams({
      floor_id: String(floorId),
      reservation_date: reservationDate,
    })
    const cacheKey = scopedCacheKey(token, `occupancy:${params.toString()}`)
    const cached = getCached<SpaceOccupancy[]>(cacheKey)
    if (cached) return { success: true, data: cached }

    const response = await fetch(`${API_BASE_URL}/reservations/occupancy?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (isInvalidSessionResponse(response)) return unauthorizedResult()

    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }

    const data = await response.json()
    setCached(cacheKey, data, 8000)
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function createReservation(
  request: ReservationRequest,
  token: string
): Promise<ServiceResult<ReservationResponse>> {
  try {
    const body: {
      space_id?: number | null
      reservation_date: string
      start_time: string
      end_time: string
      requiere_estacionamiento: boolean
      vehicle_id?: number | null
    } = {
      reservation_date: request.reservation_date,
      start_time: request.start_time,
      end_time: request.end_time,
      requiere_estacionamiento: request.requiere_estacionamiento ?? false,
    }
    if (request.vehicle_id !== undefined) {
      body.vehicle_id = request.vehicle_id
    }

    if (request.space_id !== undefined) {
      body.space_id = request.space_id
    }

    const response = await fetch(`${API_BASE_URL}/reservations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (isInvalidSessionResponse(response)) return unauthorizedResult()

    if (!response.ok) {
      const body: ApiErrorResponse = await response.json();
      return { success: false, error: body.error, unauthorized: false };
    }

    const data: ReservationResponse = await response.json();
    clearReservationCache()
    return { success: true, data };
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false };
  }
}

export async function fetchRecommendations(
  filters: FilterValues,
  token: string
): Promise<ServiceResult<RecommendationResult>> {
  try {
    const params = new URLSearchParams({
      reservation_date: filters.reservation_date,
      start_time: filters.start_time,
      end_time: filters.end_time,
    })
    if (filters.floor_id !== null) params.set('floor_id', String(filters.floor_id))
    if (filters.priority_category !== null) params.set('priority_category', filters.priority_category)

    const response = await fetch(`${API_BASE_URL}/reservations/recommendations?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    return { success: true, data: await response.json() }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export function subscribeReservationEvents(
  token: string,
  onEvent: (event: ReservationRealtimeEvent) => void,
  onError?: () => void,
  onOpen?: () => void
): () => void {
  const url = new URL(`${API_BASE_URL}/reservations/events`)
  url.searchParams.set('token', token)

  const source = new EventSource(url.toString())
  source.onopen = () => {
    onOpen?.()
  }
  source.addEventListener('reservation', (message) => {
    try {
      onEvent(JSON.parse(message.data) as ReservationRealtimeEvent)
    } catch {
      // Ignore malformed realtime payloads; the next event will resync the UI.
    }
  })
  source.onerror = () => {
    onError?.()
  }

  return () => source.close()
}

export async function askReservationAssistant(
  token: string,
  message: string
): Promise<ServiceResult<AssistantResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/assistant`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    return { success: true, data: await response.json() }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function fetchAdminOverview(
  token: string,
  date: string
): Promise<ServiceResult<AdminKpiOverview>> {
  try {
    const params = new URLSearchParams({ date })
    const cacheKey = scopedCacheKey(token, `admin:${params.toString()}`)
    const cached = getCached<AdminKpiOverview>(cacheKey)
    if (cached) return { success: true, data: cached }
    const response = await fetch(`${API_BASE_URL}/reservations/admin/overview?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data = await response.json()
    setCached(cacheKey, data, 10000)
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function blockArea(
  token: string,
  payload: { floor_id: number; priority_category: string; reason: string }
): Promise<ServiceResult<AreaBlock>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/admin/area-blocks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data = await response.json()
    clearReservationCache()
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function unblockArea(
  token: string,
  blockId: number
): Promise<ServiceResult<{ status: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/admin/area-blocks/${blockId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data = await response.json()
    clearReservationCache()
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function blockSpace(
  token: string,
  payload: {
    space_id: number
    block_date: string
    start_time: string
    end_time: string
    reason: string
  }
): Promise<ServiceResult<SpaceBlock>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/admin/space-blocks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data = await response.json()
    clearReservationCache()
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function unblockSpace(
  token: string,
  blockId: number
): Promise<ServiceResult<{ status: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/admin/space-blocks/${blockId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data = await response.json()
    clearReservationCache()
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function fetchGuardParking(
  token: string,
  date: string,
  query?: string
): Promise<ServiceResult<ParkingReservationForGuard[]>> {
  try {
    const params = new URLSearchParams({ date })
    if (query?.trim()) params.set('q', query.trim())
    const cacheKey = scopedCacheKey(token, `guard:${params.toString()}`)
    const cached = getCached<ParkingReservationForGuard[]>(cacheKey)
    if (cached) return { success: true, data: cached }
    const response = await fetch(`${API_BASE_URL}/reservations/guard/parking?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data = await response.json()
    setCached(cacheKey, data, 10000)
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function fetchMyReservations(
  token: string,
  status?: string
): Promise<ServiceResult<UserReservation[]>> {
  try {
    const url = new URL(`${API_BASE_URL}/reservations/my`);
    if (status) url.searchParams.set('status', status);
    const cacheKey = scopedCacheKey(token, `my:${url.searchParams.toString()}`)
    const cached = getCached<UserReservation[]>(cacheKey)
    if (cached) return { success: true, data: cached }
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (isInvalidSessionResponse(response)) return unauthorizedResult();
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json();
      return { success: false, error: body.error, unauthorized: false };
    }
    const data: UserReservation[] = await response.json();
    setCached(cacheKey, data, 10000)
    return { success: true, data };
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false };
  }
}

export async function checkInReservation(
  id: number,
  token: string
): Promise<ServiceResult<CheckInPayload>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/${id}/check-in`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data: CheckInPayload = await response.json()
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function cancelReservation(
  id: number,
  token: string
): Promise<ServiceResult<{ message: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (isInvalidSessionResponse(response)) return unauthorizedResult();
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json();
      return { success: false, error: body.error, unauthorized: false };
    }
    const data = await response.json();
    clearReservationCache()
    return { success: true, data };
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false };
  }
}

export async function fetchMyVehicles(token: string): Promise<ServiceResult<UserVehicle[]>> {
  try {
    const cacheKey = scopedCacheKey(token, 'vehicles:me')
    const cached = getCached<UserVehicle[]>(cacheKey)
    if (cached) return { success: true, data: cached }
    const response = await fetch(`${API_BASE_URL}/reservations/vehicles`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data = await response.json()
    setCached(cacheKey, data, 30000)
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function createVehicle(
  token: string,
  payload: { plate: string; alias?: string; make?: string; model?: string; color?: string; is_default?: boolean }
): Promise<ServiceResult<UserVehicle>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/vehicles`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data = await response.json()
    responseCache.delete(scopedCacheKey(token, 'vehicles:me'))
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function updateVehicle(
  token: string,
  vehicleId: number,
  payload: { plate: string; alias?: string; make?: string; model?: string; color?: string; is_default?: boolean }
): Promise<ServiceResult<UserVehicle>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/vehicles/${vehicleId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data = await response.json()
    responseCache.delete(scopedCacheKey(token, 'vehicles:me'))
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function setDefaultVehicle(
  token: string,
  vehicleId: number
): Promise<ServiceResult<UserVehicle>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/vehicles/${vehicleId}/default`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data = await response.json()
    responseCache.delete(scopedCacheKey(token, 'vehicles:me'))
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function deleteVehicle(
  token: string,
  vehicleId: number
): Promise<ServiceResult<{ status: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/reservations/vehicles/${vehicleId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data = await response.json()
    responseCache.delete(scopedCacheKey(token, 'vehicles:me'))
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function fetchAuditLogs(
  token: string,
  query = ''
): Promise<ServiceResult<AuditLogEntry[]>> {
  try {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    params.set('limit', '80')
    const cacheKey = scopedCacheKey(token, `audit:${params.toString()}`)
    const cached = getCached<AuditLogEntry[]>(cacheKey)
    if (cached) return { success: true, data: cached }
    const response = await fetch(`${API_BASE_URL}/reservations/admin/audit-logs?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data = await response.json()
    setCached(cacheKey, data, 10000)
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}

export async function searchUsers(token: string, query: string): Promise<ServiceResult<UserSearchResult[]>> {
  try {
    const q = query.trim()
    if (q.length < 2) return { success: true, data: [] }
    const params = new URLSearchParams({ q })
    const cacheKey = scopedCacheKey(token, `users:${params.toString()}`)
    const cached = getCached<UserSearchResult[]>(cacheKey)
    if (cached) return { success: true, data: cached }
    const response = await fetch(`${API_BASE_URL}/reservations/users/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (isInvalidSessionResponse(response)) return unauthorizedResult()
    if (!response.ok) {
      const body: ApiErrorResponse = await response.json()
      return { success: false, error: body.error, unauthorized: false }
    }
    const data = await response.json()
    setCached(cacheKey, data, 15000)
    return { success: true, data }
  } catch {
    return { success: false, error: 'NETWORK_ERROR', unauthorized: false }
  }
}
