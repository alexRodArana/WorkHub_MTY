import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ReservationService } from "./ReservationService"
import type { SpaceRepository } from "../repositories/SpaceRepository"
import type { ReservationRepository } from "../repositories/ReservationRepository"
import type { ParkingRepository } from "../repositories/ParkingRepository"
import type { BadgeService } from "./BadgeService"
import type { AdminKpiOverview, ParkingReservationForGuard, PublicUserProfile, Reservation, UserReservation } from "../interfaces"

vi.mock("../config", () => ({
  getAllowedCheckInCidrs: vi.fn().mockReturnValue([]),
  getCheckInWindowOverrideMinutes: vi.fn().mockReturnValue(null),
}))

const FUTURE_DATE = "2099-06-01"

const teammate: PublicUserProfile = {
  id: 11,
  first_name: "Ana",
  last_name: "Garcia",
  email: "ana@example.com",
  department: "Delivery",
  profile_photo_url: "data:image/png;base64,AAAA",
}

function makeSpace(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    space_number: "PB-01",
    floor_id: 1,
    priority_category: "escritorio" as const,
    is_active: true,
    layout_type: "desk" as const,
    layout_direction: "up" as const,
    layout_cx: 0.1,
    layout_cy: 0.1,
    layout_points: null,
    visual_only: false,
    ...overrides,
  }
}

function makeReservationResult(overrides: Record<string, unknown> = {}) {
  return {
    reservation_id: 10,
    reservation_code: "ABCD1234",
    space_id: 5,
    reservation_date: FUTURE_DATE,
    start_time: "09:00",
    end_time: "10:00",
    status: "confirmada" as const,
    requiere_estacionamiento: false,
    parking_spot: null,
    ...overrides,
  }
}

function makeUserReservation(overrides: Partial<UserReservation> = {}): UserReservation {
  return {
    reservation_id: 10,
    reservation_code: "ABCD1234",
    space_number: "PB-01",
    floor_name: "Planta baja",
    floor_number: 0,
    reservation_date: FUTURE_DATE,
    start_time: "09:00",
    end_time: "10:00",
    status: "confirmada",
    grace_period_minutes: 15,
    check_in_time: null,
    check_out_time: null,
    parking_spot_number: null,
    parking_zone_name: null,
    vehicle_plate: null,
    vehicle_label: null,
    ...overrides,
  }
}

function makeGuardParkingReservation(overrides: Partial<ParkingReservationForGuard> = {}): ParkingReservationForGuard {
  return {
    reservation_id: 70,
    reservation_code: "PARK1234",
    reservation_date: FUTURE_DATE,
    start_time: "09:00",
    end_time: "10:00",
    status: "confirmada",
    parking_spot_number: "T1-01",
    parking_zone_name: "T1",
    user: teammate,
    space_number: "Solo estacionamiento",
    floor_name: "Estacionamiento",
    vehicle_plate: "ABC-123",
    vehicle_label: "Civic",
    ...overrides,
  }
}

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 10,
    user_id: 7,
    space_id: 5,
    reservation_date: FUTURE_DATE,
    start_time: "09:00",
    end_time: "10:00",
    status: "confirmada",
    check_in_time: null,
    check_out_time: null,
    grace_period_minutes: 15,
    reservation_code: "ABCD1234",
    requiere_estacionamiento: false,
    parking_spot_id: null,
    vehicle_id: null,
    created_at: new Date("2099-01-01T00:00:00Z"),
    updated_at: new Date("2099-01-01T00:00:00Z"),
    ...overrides,
  }
}

function makeAdminOverview(overrides: Partial<AdminKpiOverview> = {}): AdminKpiOverview {
  return {
    date: FUTURE_DATE,
    total_reservations: 12,
    active_reservations: 3,
    confirmed_reservations: 8,
    finalized_reservations: 0,
    cancelled_reservations: 1,
    no_show_reservations: 0,
    parking_reservations: 4,
    parking_rate: 0.33,
    workspace_reservations: 10,
    desk_only_reservations: 6,
    desk_parking_reservations: 4,
    parking_only_reservations: 2,
    available_spaces: 18,
    average_duration_minutes: 120,
    check_in_rate: 0.3,
    cancellation_rate: 0.08,
    no_show_rate: 0,
    unique_users: 9,
    total_spaces: 30,
    occupied_spaces: 12,
    occupancy_rate: 0.4,
    blocked_area_count: 1,
    blocked_space_count: 2,
    status_breakdown: [{ status: "confirmada", count: 8 }],
    reservation_type_breakdown: [
      { type: "desk_only", count: 6 },
      { type: "desk_parking", count: 4 },
      { type: "parking_only", count: 2 },
    ],
    hourly_distribution: [{ hour: "09:00", reservations: 4 }],
    top_users: [{ user_id: 7, first_name: "Ada", last_name: "Lovelace", email: "ada@example.com", reservations: 3 }],
    top_spaces: [{ space_id: 5, space_number: "PB-01", display_name: null, floor_name: "Planta baja", reservations: 4 }],
    underused_spaces: [{ space_id: 9, space_number: "P9-01", display_name: null, floor_name: "Piso 9", reservations: 0, last_reservation_date: null }],
    by_floor: [{ floor_id: 0, floor_name: "Planta baja", total_spaces: 10, occupied_spaces: 4, occupancy_rate: 0.4 }],
    by_category: [{ priority_category: "escritorio", total_spaces: 20, occupied_spaces: 8, occupancy_rate: 0.4 }],
    blocked_areas: [{
      id: 1,
      floor_id: 0,
      floor_name: "Planta baja",
      priority_category: "colaborativo",
      reason: "Mantenimiento",
      is_active: true,
      created_at: new Date("2099-01-01T00:00:00Z"),
    }],
    blocked_spaces: [{
      id: 2,
      space_id: 5,
      space_number: "PB-01",
      floor_id: 0,
      floor_name: "Planta baja",
      block_date: FUTURE_DATE,
      start_time: "13:00",
      end_time: "14:00",
      reason: "Limpieza",
      is_active: true,
      created_at: new Date("2099-01-01T00:00:00Z"),
    }],
    reservations_detail: [{
      reservation_id: 10,
      reservation_code: "ABCD1234",
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      status: "confirmada",
      type: "desk_parking",
      user_id: 7,
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      department: "Engineering",
      space_id: 5,
      space_number: "PB-01",
      display_name: null,
      floor_id: 0,
      floor_name: "Planta baja",
      floor_number: 0,
      parking_spot_number: "T1-01",
      parking_zone_name: "T1",
      vehicle_id: 3,
      vehicle_plate: "ABC-123",
      vehicle_label: "Civic",
    }],
    ...overrides,
  }
}

describe("ReservationService", () => {
  let spaceRepository: SpaceRepository
  let reservationRepository: ReservationRepository
  let parkingRepository: ParkingRepository
  let badgeService: BadgeService
  let service: ReservationService

  beforeEach(() => {
    process.env.AI_PROVIDER = "gemini"
    process.env.GEMINI_API_KEY = "test-gemini-key"
    process.env.GEMINI_MODEL = "gemini-2.5-flash-lite"
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: { body?: string } = {}) => {
      const request = JSON.parse(init.body ?? "{}") as {
        contents?: Array<{ parts?: Array<{ text?: string }> }>
      }
      const input = request.contents?.[0]?.parts?.[0]?.text ?? "{}"
      const context = JSON.parse(input) as {
        predicted_occupancy?: number
        candidates?: Array<{ space_id: number; floor_id: number; local_score?: number }>
      }
      const candidates = context.candidates ?? []
      const byFloor: typeof candidates = []
      const seenFloors = new Set<number>()
      for (const candidate of candidates) {
        if (!seenFloors.has(candidate.floor_id)) {
          seenFloors.add(candidate.floor_id)
          byFloor.push(candidate)
        }
      }
      const selected = [
        ...byFloor,
        ...candidates.filter((candidate) => !byFloor.some((item) => item.space_id === candidate.space_id)),
      ].slice(0, 6)

      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  predicted_occupancy: context.predicted_occupancy ?? 0.5,
                  prediction_label: (context.predicted_occupancy ?? 0) >= 0.7 ? "alta" : "media",
                  recommendations: selected.map((candidate) => ({
                    space_id: candidate.space_id,
                    reason: "Seleccionado por Gemini usando contexto de prueba",
                    score: candidate.local_score ?? 88,
                    confidence: 0.9,
                  })),
                }),
              }],
            },
          }],
        }),
      }
    }))

    spaceRepository = {
      findAvailable: vi.fn().mockResolvedValue([makeSpace()]),
      findById: vi.fn().mockResolvedValue(makeSpace()),
    } as unknown as SpaceRepository

    reservationRepository = {
      hasOverlappingOfficeForUser: vi.fn().mockResolvedValue(false),
      hasOverlappingParkingForUser: vi.fn().mockResolvedValue(false),
      hasOverlappingForSpace: vi.fn().mockResolvedValue(false),
      hasOverlappingBlockForSpace: vi.fn().mockResolvedValue(false),
      findVehiclesByUser: vi.fn().mockResolvedValue([{
        id: 3,
        user_id: 7,
        alias: "Demo principal",
        plate: "ABC-123",
        make: "Honda",
        model: "Civic",
        color: "Gris",
        is_default: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      }]),
      findVehicleByUser: vi.fn().mockResolvedValue({
        id: 3,
        user_id: 7,
        alias: "Demo principal",
        plate: "ABC-123",
        make: "Honda",
        model: "Civic",
        color: "Gris",
        is_default: true,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      }),
      findByCode: vi.fn().mockResolvedValue(null),
      findById: vi.fn(),
      findByUserId: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(makeReservationResult()),
      update: vi.fn(),
      findPendingCheckInCandidates: vi.fn().mockResolvedValue([]),
      findCurrentOccupants: vi.fn().mockResolvedValue([]),
      findFrequentNeighbors: vi.fn().mockResolvedValue(new Map()),
      findPredictedOccupancy: vi.fn().mockResolvedValue(0.25),
      findUserPreferenceSignals: vi.fn().mockResolvedValue({
        total_reservations: 0,
        spaces: new Map(),
        floors: new Map(),
        categories: new Map(),
      }),
      findSpaceDemandScores: vi.fn().mockResolvedValue(new Map()),
      getAdminOverview: vi.fn(),
      findParkingReservationsByDate: vi.fn().mockResolvedValue([]),
    } as unknown as ReservationRepository

    parkingRepository = {
      assignSpot: vi.fn().mockResolvedValue({ spot_id: 1, zone_name: "T1", spot_number: "T1-01" }),
    } as unknown as ParkingRepository

    badgeService = {
      evaluateAfterReservation: vi.fn().mockResolvedValue([]),
      evaluateAfterCheckIn: vi.fn().mockResolvedValue([]),
      findEarnedWithStatus: vi.fn().mockResolvedValue([]),
    } as unknown as BadgeService

    service = new ReservationService(
      spaceRepository,
      reservationRepository,
      parkingRepository,
      undefined,
      badgeService
    )
  })

  afterEach(() => {
    delete process.env.AI_PROVIDER
    delete process.env.GEMINI_API_KEY
    delete process.env.GEMINI_MODEL
    vi.unstubAllGlobals()
  })

  it("creates a workspace reservation without assigning parking when parking is not requested", async () => {
    const result = await service.createReservation({
      space_id: 5,
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
    }, 7)

    expect(result).toMatchObject({
      reservation_id: 10,
      space_id: 5,
      requiere_estacionamiento: false,
      parking_spot: null,
    })
    expect(reservationRepository.hasOverlappingOfficeForUser).toHaveBeenCalledWith(7, FUTURE_DATE, "09:00", "10:00")
    expect(reservationRepository.hasOverlappingParkingForUser).not.toHaveBeenCalled()
    expect(parkingRepository.assignSpot).not.toHaveBeenCalled()
    expect(reservationRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 7,
      space_id: 5,
      requiere_estacionamiento: false,
    }))
  })

  it("assigns parking as part of a workspace reservation when requested", async () => {
    vi.mocked(reservationRepository.create).mockResolvedValue(makeReservationResult({
      requiere_estacionamiento: true,
    }))

    const result = await service.createReservation({
      space_id: 5,
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      requiere_estacionamiento: true,
    }, 7)

    expect(reservationRepository.hasOverlappingParkingForUser).toHaveBeenCalledWith(7, FUTURE_DATE, "09:00", "10:00")
    expect(reservationRepository.findVehiclesByUser).toHaveBeenCalledWith(7)
    expect(parkingRepository.assignSpot).toHaveBeenCalledWith(10, FUTURE_DATE, "09:00", "10:00")
    expect(reservationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ vehicle_id: 3 }))
    expect(result.parking_spot).toMatchObject({ zone_name: "T1", spot_number: "T1-01" })
  })

  it("creates a parking-only reservation without requiring a workspace id", async () => {
    vi.mocked(reservationRepository.create).mockResolvedValue(makeReservationResult({
      space_id: null,
      requiere_estacionamiento: true,
    }))

    const result = await service.createReservation({
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      requiere_estacionamiento: true,
    }, 7)

    expect(spaceRepository.findById).not.toHaveBeenCalled()
    expect(reservationRepository.hasOverlappingOfficeForUser).not.toHaveBeenCalled()
    expect(reservationRepository.hasOverlappingForSpace).not.toHaveBeenCalled()
    expect(reservationRepository.hasOverlappingBlockForSpace).not.toHaveBeenCalled()
    expect(reservationRepository.hasOverlappingParkingForUser).toHaveBeenCalledWith(7, FUTURE_DATE, "09:00", "10:00")
    expect(reservationRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 7,
      space_id: null,
      requiere_estacionamiento: true,
      vehicle_id: 3,
    }))
    expect(parkingRepository.assignSpot).toHaveBeenCalledWith(10, FUTURE_DATE, "09:00", "10:00")
    expect(result).toMatchObject({
      space_id: null,
      requiere_estacionamiento: true,
      parking_spot: { zone_name: "T1", spot_number: "T1-01" },
    })
  })

  it("rejects requests without workspace and without parking", async () => {
    await expect(service.createReservation({
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
    }, 7)).rejects.toMatchObject({ code: "MISSING_FIELDS" })

    expect(spaceRepository.findById).not.toHaveBeenCalled()
    expect(reservationRepository.create).not.toHaveBeenCalled()
    expect(parkingRepository.assignSpot).not.toHaveBeenCalled()
  })

  it("cancels the pending reservation when parking is unavailable", async () => {
    vi.mocked(reservationRepository.create).mockResolvedValue(makeReservationResult({
      space_id: null,
      requiere_estacionamiento: true,
    }))
    vi.mocked(parkingRepository.assignSpot).mockResolvedValue(null)

    await expect(service.createReservation({
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      requiere_estacionamiento: true,
    }, 7)).rejects.toMatchObject({ code: "PARKING_UNAVAILABLE" })

    expect(reservationRepository.update).toHaveBeenCalledWith(10, { status: "cancelada" })
  })

  it("requires a registered vehicle before assigning parking", async () => {
    vi.mocked(reservationRepository.findVehiclesByUser).mockResolvedValue([])

    await expect(service.createReservation({
      space_id: 5,
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      requiere_estacionamiento: true,
    }, 7)).rejects.toMatchObject({ code: "VEHICLE_REQUIRED" })

    expect(reservationRepository.create).not.toHaveBeenCalled()
    expect(parkingRepository.assignSpot).not.toHaveBeenCalled()
  })

  it("requires explicit vehicle selection when the user has multiple vehicles", async () => {
    vi.mocked(reservationRepository.findVehiclesByUser).mockResolvedValue([
      { id: 3, user_id: 7, alias: "Civic", plate: "ABC-123", make: "Honda", model: "Civic", color: "Gris", is_default: true, is_active: true, created_at: new Date(), updated_at: new Date() },
      { id: 4, user_id: 7, alias: "Mazda", plate: "XYZ-789", make: "Mazda", model: "3", color: "Rojo", is_default: false, is_active: true, created_at: new Date(), updated_at: new Date() },
    ])

    await expect(service.createReservation({
      space_id: 5,
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      requiere_estacionamiento: true,
    }, 7)).rejects.toMatchObject({ code: "VEHICLE_SELECTION_REQUIRED" })

    expect(reservationRepository.create).not.toHaveBeenCalled()
  })

  it("finalizes an active workspace reservation on check-out", async () => {
    vi.mocked(reservationRepository.findById).mockResolvedValue(makeReservation({
      status: "activa",
      check_in_time: new Date("2099-06-01T09:00:00Z"),
    }))

    const result = await service.checkOut(10, 7)

    expect(result.check_out_time).toBeInstanceOf(Date)
    expect(reservationRepository.update).toHaveBeenCalledWith(10, {
      status: "finalizada",
      check_out_time: expect.any(Date),
    })
  })

  it("rejects check-out when the reservation is not active", async () => {
    vi.mocked(reservationRepository.findById).mockResolvedValue(makeReservation({ status: "confirmada" }))

    await expect(service.checkOut(10, 7)).rejects.toMatchObject({ code: "CHECK_OUT_NOT_AVAILABLE" })

    expect(reservationRepository.update).not.toHaveBeenCalled()
  })

  it("returns intelligent recommendations near frequent collaborators", async () => {
    vi.mocked(spaceRepository.findAvailable).mockResolvedValue([
      makeSpace({ id: 21, space_number: "PB-21", layout_cx: 0.18, layout_cy: 0.18 }),
      makeSpace({ id: 22, space_number: "PB-22", layout_cx: 0.9, layout_cy: 0.9 }),
    ])
    vi.mocked(reservationRepository.findCurrentOccupants).mockResolvedValue([
      {
        space_id: 20,
        floor_id: 1,
        layout_cx: 0.2,
        layout_cy: 0.2,
        user: teammate,
      },
    ])
    vi.mocked(reservationRepository.findFrequentNeighbors).mockResolvedValue(new Map([[11, 8]]))
    vi.mocked(reservationRepository.findPredictedOccupancy).mockResolvedValue(0.82)
    vi.mocked(reservationRepository.findUserPreferenceSignals).mockResolvedValue({
      total_reservations: 5,
      spaces: new Map([[21, 2]]),
      floors: new Map([[1, 5]]),
      categories: new Map([["escritorio", 5]]),
    })
    vi.mocked(reservationRepository.findSpaceDemandScores).mockResolvedValue(new Map([[21, 0.2], [22, 0.8]]))

    const result = await service.getRecommendations({
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      floor_id: 1,
      priority_category: "escritorio",
    }, 7)

    expect(result.prediction_label).toBe("alta")
    expect(result.model.name).toContain("Gemini API")
    expect(result.model.factors).toContain("colaboradores frecuentes presentes en el horario")
    expect(result.recommendations[0]).toMatchObject({
      space: expect.objectContaining({ id: 21 }),
      nearby_user: teammate,
    })
    expect(result.recommendations[0].confidence).toBeGreaterThan(0.5)
    expect(result.recommendations[0].signals.some((signal) => signal.label === "Colaboración")).toBe(true)
    expect(result.recommendations[0].reasons.join(" ")).toContain("Ana Garcia")
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0][0])).toContain("generativelanguage.googleapis.com")
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0][0])).toContain("gemini-2.5-flash-lite")
    const geminiRequest = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1].body as string)
    expect(geminiRequest.generationConfig.responseSchema).toBeDefined()
    expect(geminiRequest.generationConfig.responseJsonSchema).toBeUndefined()
  })

  it("does not fall back to local recommendations when Gemini returns invalid space ids", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                predicted_occupancy: 0.2,
                prediction_label: "baja",
                recommendations: [{
                  space_id: 9999,
                  reason: "ID inexistente que debe descartarse",
                  score: 99,
                  confidence: 0.99,
                }],
              }),
            }],
          },
        }],
      }),
    }))

    const result = await service.getRecommendations({
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      priority_category: "escritorio",
    }, 7)

    expect(result.model.name).toContain("Gemini API")
    expect(result.recommendations).toHaveLength(0)
    expect(result.model.confidence).toBe(0)
  })

  it("requires Gemini configuration before generating recommendations", async () => {
    delete process.env.GEMINI_API_KEY

    await expect(service.getRecommendations({
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      priority_category: "escritorio",
    }, 7)).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" })

    expect(spaceRepository.findAvailable).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("calls Gemini on every recommendation request instead of serving a local cache", async () => {
    const filter = {
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      priority_category: "escritorio" as const,
    }

    await service.getRecommendations(filter, 7)
    await service.getRecommendations(filter, 7)

    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it("sends only individual desks to Gemini recommendation selection", async () => {
    vi.mocked(spaceRepository.findAvailable).mockResolvedValue([
      makeSpace({ id: 41, space_number: "PB-41", priority_category: "escritorio", layout_type: "desk" }),
      makeSpace({ id: 42, space_number: "Sala Norte", priority_category: "colaborativo", layout_type: "polygon" }),
      makeSpace({ id: 43, space_number: "Phone 1", priority_category: "phone_booth", layout_type: "rect" }),
      makeSpace({ id: 44, space_number: "Lab 1", priority_category: "work_lab", layout_type: "polygon" }),
    ])

    const result = await service.getRecommendations({
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
    }, 7)
    const fetchMock = vi.mocked(globalThis.fetch)
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as {
      contents: Array<{ parts: Array<{ text: string }> }>
    }
    const context = JSON.parse(body.contents[0].parts[0].text) as {
      candidates: Array<{ space_id: number; category: string }>
    }

    expect(context.candidates).toEqual([
      expect.objectContaining({ space_id: 41, category: "escritorio" }),
    ])
    expect(result.recommendations.map((item) => item.space.id)).toEqual([41])
  })

  it("answers assistant questions through Gemini using only authorized context", async () => {
    vi.mocked(reservationRepository.findByUserId).mockImplementation(async (_userId: number, status?: string) => {
      if (status === "current") {
        return [makeUserReservation({
          reservation_code: "LIVE1234",
          space_number: "PB-07",
          parking_spot_number: "T1-01",
          parking_zone_name: "T1",
          vehicle_plate: "ABC-123",
          vehicle_label: "Civic",
        })]
      }

      return [
        makeUserReservation({
          reservation_code: "LIVE1234",
          space_number: "PB-07",
          parking_spot_number: "T1-01",
          parking_zone_name: "T1",
          vehicle_plate: "ABC-123",
          vehicle_label: "Civic",
        }),
        makeUserReservation({
          reservation_id: 11,
          reservation_code: "PAST1234",
          reservation_date: "2099-05-30",
          status: "activa",
          space_number: "P9-03",
          floor_name: "Piso 9",
          floor_number: 9,
        }),
      ]
    })
    vi.mocked(badgeService.findEarnedWithStatus).mockResolvedValue([
      {
        id: 1,
        key: "bienvenido_colega",
        name: "Bienvenido colega",
        description: "Primera reserva completada",
        earned_percentage: 84.5,
        earned_at: "2099-06-01T10:00:00.000Z",
      },
      {
        id: 2,
        key: "cafecito_en_la_mano",
        name: "Cafecito en la mano",
        description: "Completa cinco reservas",
        earned_percentage: 51.2,
        earned_at: null,
      },
    ])
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                answer: "No tienes reservas activas con el contexto disponible.",
                confidence: 0.83,
                intent: "general",
                actions: [{ label: "Ver mis reservas", to: "/mis-reservas" }],
              }),
            }],
          },
        }],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await service.answerAssistantQuestion("¿tengo algo reservado?", 7, "employee")
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      systemInstruction: { parts: Array<{ text: string }> }
      contents: Array<{ parts: Array<{ text: string }> }>
    }
    const context = JSON.parse(body.contents[0].parts[0].text) as {
      user: { id: number; role: string; assistant_role: string }
      employee_profile: {
        current_reservations: Array<{ space_number: string; vehicle_plate: string }>
        reservation_history: Array<{ reservation_code: string }>
        vehicles: Array<{ plate: string }>
        badges: {
          earned: Array<{ key: string; earned_percentage: number }>
          pending: Array<{ key: string }>
        }
      }
      admin_view: unknown
      guard_view: unknown
      available_actions: Array<{ to: string }>
    }

    expect(String(fetchMock.mock.calls[0][0])).toContain("generativelanguage.googleapis.com")
    expect(String(fetchMock.mock.calls[0][0])).toContain("gemini-2.5-flash-lite")
    expect(body.systemInstruction.parts[0].text).toContain("Usa SOLO el JSON de contexto recibido")
    expect(context.user).toEqual({ id: 7, role: "employee", assistant_role: "employee", is_admin: false, is_guard: false })
    expect(context.employee_profile.current_reservations[0]).toMatchObject({
      space_number: "PB-07",
      vehicle_plate: "ABC-123",
    })
    expect(context.employee_profile.reservation_history.map((item) => item.reservation_code)).toEqual(["LIVE1234", "PAST1234"])
    expect(context.employee_profile.vehicles[0]).toMatchObject({ plate: "ABC-123" })
    expect(context.employee_profile.badges.earned[0]).toMatchObject({ key: "bienvenido_colega", earned_percentage: 84.5 })
    expect(context.employee_profile.badges.pending[0]).toMatchObject({ key: "cafecito_en_la_mano" })
    expect(context.admin_view).toBeNull()
    expect(context.guard_view).toBeNull()
    expect(context.available_actions.map((action) => action.to)).toContain("/nueva-reserva")
    expect(result.answer).toContain("contexto disponible")
  })

  it("limits assistant actions to routes allowed for the user role", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                answer: "Puedes revisar tu perfil.",
                confidence: 0.9,
                intent: "general",
                actions: [
                  { label: "Admin", to: "/admin" },
                  { label: "Espacio inventado", to: "/spaces/999" },
                  { label: "Perfil", to: "/perfil/" },
                ],
              }),
            }],
          },
        }],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await service.answerAssistantQuestion("abre mi perfil", 7, "employee")

    expect(result.actions).toEqual([{ label: "Perfil", to: "/perfil" }])
  })

  it("builds guard assistant context with parking reservations only", async () => {
    vi.mocked(reservationRepository.findParkingReservationsByDate).mockResolvedValue([
      makeGuardParkingReservation({
        parking_spot_number: "C-12",
        parking_zone_name: "Central",
      }),
    ])
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                answer: "Hoy hay 1 reserva de estacionamiento visible para guardia.",
                confidence: 0.88,
                intent: "parking",
                actions: [
                  { label: "Admin", to: "/admin" },
                  { label: "Guardia", to: "/guardia" },
                ],
              }),
            }],
          },
        }],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await service.answerAssistantQuestion("¿quién tiene estacionamiento hoy?", 99, "guardia")
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      contents: Array<{ parts: Array<{ text: string }> }>
    }
    const context = JSON.parse(body.contents[0].parts[0].text) as {
      employee_profile: unknown
      admin_view: unknown
      guard_view: {
        total_parking_reservations: number
        parking_reservations: Array<{
          parking_zone_name: string
          parking_spot_number: string
          vehicle_plate: string | null
          user: { name: string }
        }>
      }
    }

    expect(context.employee_profile).toBeNull()
    expect(context.admin_view).toBeNull()
    expect(context.guard_view.total_parking_reservations).toBe(1)
    expect(context.guard_view.parking_reservations[0]).toMatchObject({
      parking_zone_name: "Central",
      parking_spot_number: "C-12",
      vehicle_plate: "ABC-123",
      user: { name: "Ana Garcia" },
    })
    expect(reservationRepository.findByUserId).not.toHaveBeenCalled()
    expect(reservationRepository.findVehiclesByUser).not.toHaveBeenCalled()
    expect(result.actions).toEqual([{ label: "Guardia", to: "/guardia" }])
  })

  it("builds admin assistant context with dashboard metrics and details", async () => {
    vi.mocked(reservationRepository.getAdminOverview).mockResolvedValue(makeAdminOverview())
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                answer: "Hoy hay 12 reservas y 40% de ocupación.",
                confidence: 0.91,
                intent: "admin_insight",
                actions: [{ label: "Gestionar", to: "/admin/gestion" }],
              }),
            }],
          },
        }],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await service.answerAssistantQuestion("dame los KPIs de hoy", 1, "admin")
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      contents: Array<{ parts: Array<{ text: string }> }>
    }
    const context = JSON.parse(body.contents[0].parts[0].text) as {
      employee_profile: unknown
      guard_view: unknown
      admin_view: {
        kpis: { total_reservations: number; occupancy_rate: number }
        blocked_spaces: Array<{ space_number: string }>
        reservations_detail: Array<{ reservation_code: string; parking: { vehicle_plate: string | null } }>
      }
    }

    expect(context.employee_profile).toBeNull()
    expect(context.guard_view).toBeNull()
    expect(context.admin_view.kpis).toMatchObject({ total_reservations: 12, occupancy_rate: 0.4 })
    expect(context.admin_view.blocked_spaces[0]).toMatchObject({ space_number: "PB-01" })
    expect(context.admin_view.reservations_detail[0]).toMatchObject({
      reservation_code: "ABCD1234",
      parking: { vehicle_plate: "ABC-123" },
    })
    expect(reservationRepository.findByUserId).not.toHaveBeenCalled()
    expect(result.actions).toEqual([{ label: "Gestionar", to: "/admin/gestion" }])
  })

  it("rejects assistant responses when Gemini does not return a valid answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                answer: "",
                confidence: 0.8,
                intent: "general",
                actions: [],
              }),
            }],
          },
        }],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(service.answerAssistantQuestion("¿qué puedo hacer?", 7, "employee"))
      .rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" })
  })

  it("accepts assistant answers even when Gemini omits optional actions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                answer: "Con el contexto disponible, no tienes reservas activas.",
                intent: "reservation_status",
              }),
            }],
          },
        }],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await service.answerAssistantQuestion("¿tengo reservas?", 7, "employee")

    expect(result.answer).toContain("contexto disponible")
    expect(result.confidence).toBe(0.72)
    expect(result.intent).toBe("reservation_status")
    expect(result.actions).toEqual([])
  })

  it("uses the official Gemini responseSchema field", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                answer: "Respuesta válida.",
                confidence: 0.8,
                intent: "general",
                actions: [],
              }),
            }],
          },
        }],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await service.answerAssistantQuestion("hola", 7, "employee")
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)

    expect(body.generationConfig.responseSchema).toBeDefined()
    expect(body.generationConfig.responseJsonSchema).toBeUndefined()
  })

  it("spreads AI recommendations across floors when no floor filter is selected", async () => {
    vi.mocked(spaceRepository.findAvailable).mockResolvedValue([
      makeSpace({ id: 31, space_number: "PB-31", floor_id: 1, layout_cx: 0.11, layout_cy: 0.11 }),
      makeSpace({ id: 32, space_number: "PB-32", floor_id: 1, layout_cx: 0.12, layout_cy: 0.12 }),
      makeSpace({ id: 33, space_number: "PB-33", floor_id: 1, layout_cx: 0.13, layout_cy: 0.13 }),
      makeSpace({ id: 34, space_number: "PB-34", floor_id: 1, layout_cx: 0.14, layout_cy: 0.14 }),
      makeSpace({ id: 35, space_number: "PB-35", floor_id: 1, layout_cx: 0.15, layout_cy: 0.15 }),
      makeSpace({ id: 36, space_number: "PB-36", floor_id: 1, layout_cx: 0.16, layout_cy: 0.16 }),
      makeSpace({ id: 91, space_number: "P9-91", floor_id: 9, layout_cx: 0.42, layout_cy: 0.42 }),
    ])
    vi.mocked(reservationRepository.findPredictedOccupancy).mockResolvedValue(0.3)
    vi.mocked(reservationRepository.findUserPreferenceSignals).mockResolvedValue({
      total_reservations: 12,
      spaces: new Map([[31, 4], [32, 4], [33, 3], [34, 3], [35, 2], [36, 2]]),
      floors: new Map([[1, 12]]),
      categories: new Map([["escritorio", 12]]),
    })
    vi.mocked(reservationRepository.findSpaceDemandScores).mockResolvedValue(new Map([
      [31, 0.1],
      [32, 0.1],
      [33, 0.1],
      [34, 0.1],
      [35, 0.1],
      [36, 0.1],
      [91, 0.4],
    ]))

    const result = await service.getRecommendations({
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      priority_category: "escritorio",
    }, 7)

    expect(result.recommendations).toHaveLength(6)
    expect(result.recommendations.some((item) => item.space.floor_id === 9)).toBe(true)
  })

  it("tries a fallback Gemini model when the primary model is temporarily unavailable", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: { status: "UNAVAILABLE" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  predicted_occupancy: 0.25,
                  prediction_label: "baja",
                  recommendations: [{
                    space_id: 5,
                    reason: "Fallback Gemini eligió el mejor espacio disponible",
                    score: 91,
                    confidence: 0.88,
                  }],
                }),
              }],
            },
          }],
        }),
      })
    vi.stubGlobal("fetch", fetchMock)

    const result = await service.getRecommendations({
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      priority_category: "escritorio",
    }, 7)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toContain("gemini-2.5-flash-lite")
    expect(String(fetchMock.mock.calls[1][0])).toContain("gemini-2.5-flash")
    expect(result.recommendations[0].space.id).toBe(5)
  })

  it("tries a fallback Gemini model when the primary model is not available for the key", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { status: "NOT_FOUND" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  predicted_occupancy: 0.25,
                  prediction_label: "baja",
                  recommendations: [{
                    space_id: 5,
                    reason: "Fallback Gemini eligió un escritorio disponible",
                    score: 91,
                    confidence: 0.88,
                  }],
                }),
              }],
            },
          }],
        }),
      })
    vi.stubGlobal("fetch", fetchMock)

    const result = await service.getRecommendations({
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      priority_category: "escritorio",
    }, 7)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.recommendations[0].space.id).toBe(5)
  })

  it("omits Gemini thinkingConfig when the fallback model does not support it", async () => {
    process.env.GEMINI_FALLBACK_MODELS = "gemini-2.0-flash-lite"
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: { status: "UNAVAILABLE" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  predicted_occupancy: 0.25,
                  prediction_label: "baja",
                  recommendations: [{
                    space_id: 5,
                    reason: "Fallback Gemini eligió el mejor espacio disponible",
                    score: 91,
                    confidence: 0.88,
                  }],
                }),
              }],
            },
          }],
        }),
      })
    vi.stubGlobal("fetch", fetchMock)

    await service.getRecommendations({
      reservation_date: FUTURE_DATE,
      start_time: "09:00",
      end_time: "10:00",
      priority_category: "escritorio",
    }, 7)

    const primaryBody = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    const fallbackBody = JSON.parse(fetchMock.mock.calls[1][1].body as string)
    expect(primaryBody.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 })
    expect(fallbackBody.generationConfig.thinkingConfig).toBeUndefined()
    expect(fallbackBody.generationConfig.responseSchema).toBeDefined()
  })
})
