import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  askReservationAssistant,
  blockArea,
  blockSpace,
  checkOutReservation,
  createReservation,
  fetchAdminOverview,
  fetchAvailability,
  fetchFloorOccupancy,
  fetchGuardParking,
  fetchRecommendations,
} from './reservationService'
import type { FilterValues } from '../types/reservation'

const TOKEN = 'token-123'

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

const FILTERS: FilterValues = {
  reservation_date: '2099-06-01',
  start_time: '09:00',
  end_time: '10:00',
  floor_id: 3,
  priority_category: 'escritorio',
}

describe('reservationService', () => {
  afterEach(() => vi.restoreAllMocks())

  it('serializes availability filters into query params', async () => {
    const spy = mockFetch(200, [])

    await fetchAvailability(FILTERS, TOKEN)

    const [url, init] = spy.mock.calls[0]
    expect(String(url)).toContain('reservation_date=2099-06-01')
    expect(String(url)).toContain('start_time=09%3A00')
    expect(String(url)).toContain('end_time=10%3A00')
    expect(String(url)).toContain('floor_id=3')
    expect(String(url)).toContain('priority_category=escritorio')
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('fetches daily occupancy by floor and date', async () => {
    const spy = mockFetch(200, [{ space_id: 1, intervals: [{ start_time: '09:00', end_time: '10:00' }] }])

    const result = await fetchFloorOccupancy(3, '2099-06-01', TOKEN)

    expect(result.success).toBe(true)
    expect(String(spy.mock.calls[0][0])).toContain('/reservations/occupancy')
    expect(String(spy.mock.calls[0][0])).toContain('floor_id=3')
    expect(String(spy.mock.calls[0][0])).toContain('reservation_date=2099-06-01')
  })

  it('sends a workspace reservation with parking as an attached option', async () => {
    const spy = mockFetch(201, { reservation_id: 1 })

    await createReservation({
      space_id: 5,
      reservation_date: '2099-06-01',
      start_time: '09:00',
      end_time: '10:00',
      requiere_estacionamiento: true,
    }, TOKEN)

    const body = JSON.parse(spy.mock.calls[0][1]?.body as string)
    expect(body).toEqual({
      space_id: 5,
      reservation_date: '2099-06-01',
      start_time: '09:00',
      end_time: '10:00',
      requiere_estacionamiento: true,
    })
  })

  it('sends a parking-only reservation with a null workspace id', async () => {
    const spy = mockFetch(201, { reservation_id: 2 })

    await createReservation({
      space_id: null,
      reservation_date: '2099-06-01',
      start_time: '09:00',
      end_time: '10:00',
      requiere_estacionamiento: true,
    }, TOKEN)

    const body = JSON.parse(spy.mock.calls[0][1]?.body as string)
    expect(body).toEqual({
      space_id: null,
      reservation_date: '2099-06-01',
      start_time: '09:00',
      end_time: '10:00',
      requiere_estacionamiento: true,
    })
  })

  it('returns parking conflict errors from the API', async () => {
    mockFetch(409, { error: 'PARKING_CONFLICT', message: 'conflict' })

    const result = await createReservation({
      space_id: 5,
      reservation_date: '2099-06-01',
      start_time: '09:00',
      end_time: '10:00',
      requiere_estacionamiento: true,
    }, TOKEN)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('PARKING_CONFLICT')
      expect(result.unauthorized).toBe(false)
    }
  })

  it('posts check-out requests and returns the release timestamp', async () => {
    const spy = mockFetch(200, { message: 'Check-out realizado', check_out_time: '2099-06-01T09:45:00.000Z' })

    const result = await checkOutReservation(22, TOKEN)

    expect(result.success).toBe(true)
    expect(String(spy.mock.calls[0][0])).toContain('/reservations/22/check-out')
    expect(spy.mock.calls[0][1]?.method).toBe('POST')
    expect((spy.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('surfaces check-out availability errors from the API', async () => {
    mockFetch(409, { error: 'CHECK_OUT_NOT_AVAILABLE', message: 'No se pudo liberar el espacio' })

    const result = await checkOutReservation(22, TOKEN)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('CHECK_OUT_NOT_AVAILABLE')
      expect(result.unauthorized).toBe(false)
    }
  })

  it('fetches AI recommendations with the same filter contract', async () => {
    const spy = mockFetch(200, { predicted_occupancy: 0.5, prediction_label: 'media', recommendations: [] })

    const result = await fetchRecommendations(FILTERS, TOKEN)

    expect(result.success).toBe(true)
    expect(String(spy.mock.calls[0][0])).toContain('/reservations/recommendations')
    expect(String(spy.mock.calls[0][0])).toContain('floor_id=3')
    expect(String(spy.mock.calls[0][0])).toContain('priority_category=escritorio')
  })

  it('uses admin and guard endpoints with bearer auth', async () => {
    const spy = mockFetch(200, { date: '2099-06-01', blocked_areas: [] })

    await fetchAdminOverview(TOKEN, '2099-06-01')
    await fetchGuardParking(TOKEN, '2099-06-01')

    expect(String(spy.mock.calls[0][0])).toContain('/reservations/admin/overview')
    expect(String(spy.mock.calls[1][0])).toContain('/reservations/guard/parking')
    expect((spy.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('supports admin overview ranges for dashboard exports', async () => {
    const spy = mockFetch(200, { date: '2099-06-01', date_from: '2099-06-01', date_to: '2099-06-30', blocked_areas: [] })

    await fetchAdminOverview(TOKEN, { date_from: '2099-06-01', date_to: '2099-06-30' })

    expect(String(spy.mock.calls[0][0])).toContain('date_from=2099-06-01')
    expect(String(spy.mock.calls[0][0])).toContain('date_to=2099-06-30')
  })

  it('posts area blocks for administrators', async () => {
    const spy = mockFetch(201, { id: 1 })

    await blockArea(TOKEN, { floor_id: 1, priority_category: 'escritorio', reason: 'Mantenimiento' })

    const body = JSON.parse(spy.mock.calls[0][1]?.body as string)
    expect(String(spy.mock.calls[0][0])).toContain('/reservations/admin/area-blocks')
    expect(body).toEqual({ floor_id: 1, priority_category: 'escritorio', reason: 'Mantenimiento' })
  })

  it('posts date/time space blocks for administrators', async () => {
    const spy = mockFetch(201, { id: 7, space_id: 10 })

    await blockSpace(TOKEN, {
      space_id: 10,
      block_date: '2099-06-01',
      start_time: '09:00',
      end_time: '11:00',
      reason: 'Mantenimiento',
    })

    const body = JSON.parse(spy.mock.calls[0][1]?.body as string)
    expect(String(spy.mock.calls[0][0])).toContain('/reservations/admin/space-blocks')
    expect(body).toEqual({
      space_id: 10,
      block_date: '2099-06-01',
      start_time: '09:00',
      end_time: '11:00',
      reason: 'Mantenimiento',
    })
  })

  it('sends assistant messages to the AI endpoint', async () => {
    const spy = mockFetch(200, { answer: 'PB-01', confidence: 0.8, recommendations: [], actions: [] })

    const result = await askReservationAssistant(TOKEN, 'donde me siento')

    expect(result.success).toBe(true)
    expect(String(spy.mock.calls[0][0])).toContain('/reservations/assistant')
    expect((spy.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    expect(JSON.parse(spy.mock.calls[0][1]?.body as string)).toEqual({ message: 'donde me siento' })
  })
})
