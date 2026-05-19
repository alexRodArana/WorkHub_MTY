import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Request, Response } from "express"
import { ReservationController } from "./ReservationController"
import { AdminController } from "./AdminController"
import { GuardController } from "./GuardController"
import { ReservationAssistantController } from "./ReservationAssistantController"
import { ReservationError } from "../errors"
import type { ReservationService } from "../services/ReservationService"
import type { ReservationRepository } from "../repositories/ReservationRepository"
import type { StreakRepository } from "../repositories/StreakRepository"
import type { BadgeService } from "../services/BadgeService"

type TestResponse = Response & {
  statusCodeValue: number
  body: unknown
}

const user = {
  id: 7,
  first_name: "Ada",
  last_name: "Lovelace",
  email: "ada@example.com",
  department: "Engineering",
  profile_photo_url: "data:image/png;base64,AAAA",
}

function makeRequest({ body = {}, query = {}, params = {} }: {
  body?: unknown
  query?: Record<string, string>
  params?: Record<string, string>
} = {}): Request {
  return {
    body,
    query,
    params,
    userId: 7,
  } as Request & { userId: number }
}

function makeResponse(): TestResponse {
  const response: Partial<TestResponse> = {
    statusCodeValue: 200,
    body: undefined as unknown,
  }
  response.status = (code: number) => {
    response.statusCodeValue = code
    return response as TestResponse
  }
  response.json = (payload: unknown) => {
    response.body = payload
    return response as TestResponse
  }

  return response as TestResponse
}

describe("ReservationController integration", () => {
  let reservationService: ReservationService
  let reservationRepository: ReservationRepository
  let controller: ReservationController

  beforeEach(() => {
    reservationService = {
      createReservation: vi.fn(),
      getRecommendations: vi.fn(),
      answerAssistantQuestion: vi.fn(),
    } as unknown as ReservationService

    reservationRepository = {
      findOccupancyByFloor: vi.fn(),
    } as unknown as ReservationRepository

    controller = new ReservationController(
      reservationService,
      reservationRepository,
      {} as StreakRepository,
      {} as BadgeService
    )
  })

  it("creates a workspace reservation with optional parking and returns 201", async () => {
    vi.mocked(reservationService.createReservation).mockResolvedValue({
      reservation_id: 22,
      reservation_code: "DESK1234",
      space_id: 5,
      reservation_date: "2099-06-01",
      start_time: "09:00",
      end_time: "10:00",
      status: "confirmada",
      requiere_estacionamiento: true,
      parking_spot: { zone_name: "T1", spot_number: "T1-01" },
      newBadges: [],
    })

    const response = makeResponse()
    const body = {
      space_id: 5,
      reservation_date: "2099-06-01",
      start_time: "09:00",
      end_time: "10:00",
      requiere_estacionamiento: true,
    }

    await controller.createReservation(makeRequest({ body }), response)

    expect(response.statusCodeValue).toBe(201)
    expect(response.body).toMatchObject({
      reservation_id: 22,
      space_id: 5,
      parking_spot: { zone_name: "T1", spot_number: "T1-01" },
    })
    expect(reservationService.createReservation).toHaveBeenCalledWith(body, 7)
  })

  it("creates a parking-only reservation and returns 201", async () => {
    vi.mocked(reservationService.createReservation).mockResolvedValue({
      reservation_id: 23,
      reservation_code: "PARK1234",
      space_id: null,
      reservation_date: "2099-06-01",
      start_time: "09:00",
      end_time: "10:00",
      status: "confirmada",
      requiere_estacionamiento: true,
      parking_spot: { zone_name: "T1", spot_number: "T1-02" },
      newBadges: [],
    })

    const response = makeResponse()
    const body = {
      reservation_date: "2099-06-01",
      start_time: "09:00",
      end_time: "10:00",
      requiere_estacionamiento: true,
    }

    await controller.createReservation(makeRequest({ body }), response)

    expect(response.statusCodeValue).toBe(201)
    expect(response.body).toMatchObject({
      reservation_id: 23,
      space_id: null,
      parking_spot: { zone_name: "T1", spot_number: "T1-02" },
    })
    expect(reservationService.createReservation).toHaveBeenCalledWith(body, 7)
  })

  it("maps reservation errors to their HTTP status and API code", async () => {
    vi.mocked(reservationService.createReservation).mockRejectedValue(
      new ReservationError(409, "PARKING_CONFLICT", "El usuario ya tiene estacionamiento reservado")
    )

    const response = makeResponse()

    await controller.createReservation(makeRequest({
      body: {
        space_id: 5,
        reservation_date: "2099-06-01",
        start_time: "09:00",
        end_time: "10:00",
        requiere_estacionamiento: true,
      },
    }), response)

    expect(response.statusCodeValue).toBe(409)
    expect(response.body).toEqual({
      error: "PARKING_CONFLICT",
      message: "El usuario ya tiene estacionamiento reservado",
    })
  })

  it("returns floor occupancy with occupant profile metadata", async () => {
    vi.mocked(reservationRepository.findOccupancyByFloor).mockResolvedValue([
      {
        space_id: 9,
        intervals: [{ start_time: "09:00", end_time: "11:00", status: "confirmada", user }],
      },
    ])
    const response = makeResponse()

    await controller.getFloorOccupancy(makeRequest({
      query: { floor_id: "9", reservation_date: "2099-06-01" },
    }), response)

    expect(response.statusCodeValue).toBe(200)
    expect(response.body).toEqual([
      {
        space_id: 9,
        intervals: [{ start_time: "09:00", end_time: "11:00", status: "confirmada", user }],
      },
    ])
  })

  it("returns AI recommendations for the authenticated user", async () => {
    vi.mocked(reservationService.getRecommendations).mockResolvedValue({
      model: {
        name: "Lumina Workspace AI",
        version: "1.1.0",
        confidence: 0.84,
        factors: ["historial", "colaboracion", "ocupacion"],
      },
      predicted_occupancy: 0.8,
      prediction_label: "alta",
      recommendations: [],
    })
    const response = makeResponse()

    await controller.getRecommendations(makeRequest({
      query: {
        reservation_date: "2099-06-01",
        start_time: "09:00",
        end_time: "10:00",
        floor_id: "9",
        priority_category: "escritorio",
      },
    }), response)

    expect(response.statusCodeValue).toBe(200)
    expect(reservationService.getRecommendations).toHaveBeenCalledWith({
      reservation_date: "2099-06-01",
      start_time: "09:00",
      end_time: "10:00",
      floor_id: 9,
      priority_category: "escritorio",
    }, 7)
  })

  it("answers assistant questions with the authenticated user context", async () => {
    vi.mocked(reservationService.answerAssistantQuestion).mockResolvedValue({
      answer: "Te recomiendo PB-21.",
      confidence: 0.86,
      intent: "recommendation",
      recommendations: [{
        space_id: 21,
        space_number: "PB-21",
        floor_id: 1,
        score: 94,
        reason: "mejor disponibilidad prevista",
      }],
      actions: [{ label: "Abrir nueva reserva", to: "/nueva-reserva" }],
    })
    const response = makeResponse()

    await new ReservationAssistantController(reservationService).ask(makeRequest({
      body: { message: "¿Dónde me recomiendas sentarme?" },
    }), response)

    expect(response.statusCodeValue).toBe(200)
    expect(response.body).toMatchObject({ answer: "Te recomiendo PB-21.", intent: "recommendation" })
    expect(reservationService.answerAssistantQuestion).toHaveBeenCalledWith("¿Dónde me recomiendas sentarme?", 7, "")
  })
})

describe("AdminController", () => {
  it("blocks an area through the repository", async () => {
    const repository = {
      blockArea: vi.fn().mockResolvedValue({
        id: 3,
        floor_id: 1,
        floor_name: "Planta Baja",
        priority_category: "escritorio",
        reason: "Mantenimiento",
        is_active: true,
        created_at: new Date(),
      }),
    } as unknown as ReservationRepository
    const response = makeResponse()

    await new AdminController(repository).blockArea(makeRequest({
      body: { floor_id: 1, priority_category: "escritorio", reason: "Mantenimiento" },
    }), response)

    expect(response.statusCodeValue).toBe(201)
    expect(repository.blockArea).toHaveBeenCalledWith(1, "escritorio", "Mantenimiento")
  })

  it("blocks a single space with date and time through the repository", async () => {
    const repository = {
      blockSpace: vi.fn().mockResolvedValue({
        id: 8,
        space_id: 12,
        space_number: "PB-12",
        floor_id: 0,
        floor_name: "Planta Baja",
        block_date: "2099-06-01",
        start_time: "09:00",
        end_time: "11:00",
        reason: "Mantenimiento",
        is_active: true,
        created_at: new Date(),
      }),
    } as unknown as ReservationRepository
    const response = makeResponse()

    await new AdminController(repository).blockSpace(makeRequest({
      body: {
        space_id: 12,
        block_date: "2099-06-01",
        start_time: "09:00",
        end_time: "11:00",
        reason: "Mantenimiento",
      },
    }), response)

    expect(response.statusCodeValue).toBe(201)
    expect(repository.blockSpace).toHaveBeenCalledWith(12, "2099-06-01", "09:00", "11:00", "Mantenimiento")
  })
})

describe("GuardController", () => {
  it("returns parking reservations for the requested date", async () => {
    const repository = {
      findParkingReservationsByDate: vi.fn().mockResolvedValue([
        {
          reservation_id: 1,
          reservation_code: "PARK1234",
          reservation_date: "2099-06-01",
          start_time: "09:00",
          end_time: "10:00",
          status: "confirmada",
          parking_spot_number: "T1-01",
          parking_zone_name: "T1",
          user,
          space_number: "Solo estacionamiento",
          floor_name: "Estacionamiento",
        },
      ]),
    } as unknown as ReservationRepository
    const response = makeResponse()

    await new GuardController(repository).getParkingReservations(makeRequest({
      query: { date: "2099-06-01" },
    }), response)

    expect(response.statusCodeValue).toBe(200)
    expect(repository.findParkingReservationsByDate).toHaveBeenCalledWith("2099-06-01")
  })
})
