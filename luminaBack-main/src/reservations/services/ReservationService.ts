import { SpaceRepository } from "../repositories/SpaceRepository"
import { ReservationRepository } from "../repositories/ReservationRepository"
import { ParkingRepository } from "../repositories/ParkingRepository"
import { StreakRepository } from "../repositories/StreakRepository"
import { BadgeService } from "./BadgeService"
import { ReservationError } from "../errors"
import {
  AvailabilityFilter,
  AssistantResponse,
  CreateReservationInput,
  IntelligentRecommendation,
  RecommendationSignal,
  RecommendationResult,
  ReservationResult,
  CheckInResult,
  Space,
  UserPreferenceSignals,
} from "../interfaces"
import { getAllowedCheckInCidrs, getCheckInWindowOverrideMinutes } from "../config"

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const CODE_LENGTH = 8
const DEFAULT_TIMEZONE = process.env.RESERVATION_TIMEZONE ?? "America/Monterrey"
const CHECK_IN_POST_START_MINUTES = 30
const RECOMMENDATION_MODEL_NAME = "Gemini Workspace AI"
const RECOMMENDATION_MODEL_VERSION = "gemini-only-v1"
const GEMINI_DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash-lite"
const RECOMMENDATION_FACTORS = [
  "historial personal de espacios, pisos y categorías",
  "colaboradores frecuentes presentes en el horario",
  "proximidad espacial en el mapa",
  "ocupación histórica por día y franja horaria",
  "demanda histórica por espacio",
  "solo escritorios individuales disponibles",
]

type AiProviderName = "gemini"

interface AiProviderMetadata {
  name: AiProviderName
  label: string
  model: string
}

type AiJsonSchema = Record<string, unknown>

interface AiRecommendationChoice {
  space_id: number
  reason: string
  score: number
  confidence: number
}

interface AiRecommendationDecision {
  predicted_occupancy?: number
  prediction_label?: "baja" | "media" | "alta"
  recommendations: AiRecommendationChoice[]
}

interface AiAssistantDecision {
  answer: string
  confidence?: number
  intent?: AssistantResponse["intent"]
  actions?: Array<{ label: string; to: string }>
}

export class ReservationService {
  constructor(
    private readonly spaceRepository: SpaceRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly parkingRepository?: ParkingRepository,
    private readonly streakRepository?: StreakRepository,
    private readonly badgeService?: BadgeService
  ) {}

  async checkAvailability(filter: AvailabilityFilter, _userId: number): Promise<Space[]> {
    const today = new Date().toISOString().split("T")[0]

    if (filter.end_time <= filter.start_time) {
      throw new ReservationError(400, "INVALID_TIME_RANGE", "El tiempo de fin debe ser mayor al tiempo de inicio")
    }

    if (filter.reservation_date < today) {
      throw new ReservationError(400, "INVALID_DATE", "La fecha de reservación no puede ser en el pasado")
    }

    return this.spaceRepository.findAvailable(filter)
  }

  async createReservation(input: CreateReservationInput, userId: number): Promise<ReservationResult> {
    const { space_id, reservation_date, start_time, end_time } = input
    const requiresParking = input.requiere_estacionamiento === true
    const hasSpaceId = typeof space_id === "number" && space_id > 0
    let resolvedVehicleId: number | null = null

    if (!reservation_date || !start_time || !end_time || (!hasSpaceId && !requiresParking)) {
      throw new ReservationError(400, "MISSING_FIELDS", "Selecciona un espacio o solicita estacionamiento, además de fecha y horario")
    }

    // Validate time range
    if (end_time <= start_time) {
      throw new ReservationError(400, "INVALID_TIME_RANGE", "El tiempo de fin debe ser mayor al tiempo de inicio")
    }

    // Validate date
    const today = new Date().toISOString().split("T")[0]
    if (reservation_date < today) {
      throw new ReservationError(400, "INVALID_DATE", "La fecha de reservación no puede ser en el pasado")
    }

    // Validate parking 24h rule
    if (requiresParking) {
      const reservationStartMs = this.toWallClockTimestamp(reservation_date, start_time)
      const nowMs = this.getCurrentWallClockTime()
      if (reservationStartMs - nowMs < 24 * 60 * 60 * 1000) {
        throw new ReservationError(422, "PARKING_TOO_LATE", "El estacionamiento solo puede solicitarse con al menos 24 horas de anticipación")
      }
    }

    const resolvedSpaceId = hasSpaceId ? space_id as number : null

    if (hasSpaceId) {
      const space = await this.spaceRepository.findById(resolvedSpaceId as number)
      if (!space) {
        throw new ReservationError(404, "SPACE_NOT_FOUND", "El espacio no existe o no está disponible")
      }

      const hasOfficeConflict = await this.reservationRepository.hasOverlappingOfficeForUser(
        userId, reservation_date, start_time, end_time
      )
      if (hasOfficeConflict) {
        throw new ReservationError(409, "USER_CONFLICT", "El usuario ya tiene una reservación en ese horario")
      }

      const hasSpaceConflict = await this.reservationRepository.hasOverlappingForSpace(
        resolvedSpaceId as number, reservation_date, start_time, end_time
      )
      if (hasSpaceConflict) {
        throw new ReservationError(409, "SPACE_UNAVAILABLE", "El espacio no está disponible en ese horario")
      }

      const hasSpaceBlock = await this.reservationRepository.hasOverlappingBlockForSpace(
        resolvedSpaceId as number, reservation_date, start_time, end_time
      )
      if (hasSpaceBlock) {
        throw new ReservationError(409, "SPACE_UNAVAILABLE", "El espacio está bloqueado por administración en ese horario")
      }
    }

    if (requiresParking) {
      const vehicles = await this.reservationRepository.findVehiclesByUser(userId)
      if (vehicles.length === 0) {
        throw new ReservationError(422, "VEHICLE_REQUIRED", "Agrega un vehículo antes de reservar estacionamiento")
      }

      if (typeof input.vehicle_id === "number" && input.vehicle_id > 0) {
        const vehicle = await this.reservationRepository.findVehicleByUser(userId, input.vehicle_id)
        if (!vehicle) {
          throw new ReservationError(422, "VEHICLE_NOT_FOUND", "El vehículo seleccionado no existe o no pertenece al usuario")
        }
        resolvedVehicleId = vehicle.id
      } else if (vehicles.length === 1) {
        resolvedVehicleId = vehicles[0].id
      } else {
        throw new ReservationError(422, "VEHICLE_SELECTION_REQUIRED", "Selecciona el vehículo que usarás para el estacionamiento")
      }

      const hasParkingConflict = await this.reservationRepository.hasOverlappingParkingForUser(
        userId, reservation_date, start_time, end_time
      )
      if (hasParkingConflict) {
        throw new ReservationError(409, "PARKING_CONFLICT", "El usuario ya tiene estacionamiento reservado en ese horario")
      }

      if (!this.parkingRepository) {
        throw new ReservationError(503, "PARKING_UNAVAILABLE", "No fue posible asignar estacionamiento en este momento")
      }
    }

    // Generate unique code
    const code = await this.generateUniqueCode()

    // Create reservation
    const reservation = await this.reservationRepository.create({
      user_id: userId,
      space_id: resolvedSpaceId,
      reservation_date,
      start_time,
      end_time,
      reservation_code: code,
      status: "confirmada",
      grace_period_minutes: this.getEffectiveGracePeriodMinutes(15),
      requiere_estacionamiento: requiresParking,
      vehicle_id: resolvedVehicleId,
      check_in_time: null,
      check_out_time: null,
    })

    let finalReservation = reservation
    if (requiresParking && this.parkingRepository) {
      try {
        const spot = await this.parkingRepository.assignSpot(
          reservation.reservation_id,
          reservation_date,
          start_time,
          end_time
        )
        if (!spot) {
          await this.cancelReservationAfterParkingFailure(reservation.reservation_id)
          throw new ReservationError(409, "PARKING_UNAVAILABLE", "No hay lugares de estacionamiento disponibles para ese horario")
        }
        finalReservation = { ...reservation, parking_spot: spot }
      } catch (err) {
        if (!(err instanceof ReservationError && err.code === "PARKING_UNAVAILABLE")) {
          await this.cancelReservationAfterParkingFailure(reservation.reservation_id)
          console.error("Parking assignment failed:", err)
        }
        throw err
      }
    }

    // Evaluate reservation-trigger badges (soft failure)
    let newBadges: import("../interfaces").BadgeInfo[] = []
    if (this.badgeService) {
      try {
        newBadges = await this.badgeService.evaluateAfterReservation(userId)
      } catch (err) {
        console.error("Badge evaluation failed (reservation still created):", err)
      }
    }

    return { ...finalReservation, newBadges }
  }

  private async cancelReservationAfterParkingFailure(reservationId: number): Promise<void> {
    try {
      await this.reservationRepository.update(reservationId, { status: "cancelada" })
    } catch (err) {
      console.error("Failed to cancel reservation after parking assignment error:", err)
    }
  }

  async cancelReservation(reservationId: number, userId: number): Promise<void> {
    const reservation = await this.reservationRepository.findById(reservationId)

    if (!reservation) {
      throw new ReservationError(404, "NOT_FOUND", "Reservación no encontrada")
    }

    if (reservation.user_id !== userId) {
      throw new ReservationError(403, "FORBIDDEN", "No autorizado para cancelar esta reservación")
    }

    if (reservation.status !== "confirmada") {
      throw new ReservationError(422, "INVALID_STATUS", "Solo se pueden cancelar reservaciones con estado confirmada")
    }

    const today = new Date().toISOString().split("T")[0]
    const reservationDate = typeof reservation.reservation_date === "string"
      ? reservation.reservation_date
      : (reservation.reservation_date as Date).toISOString().split("T")[0]

    if (reservationDate < today) {
      throw new ReservationError(422, "INVALID_DATE", "No se puede cancelar una reservación pasada")
    }

    await this.reservationRepository.update(reservationId, { status: "cancelada" })
  }

  async checkIn(reservationId: number, userId: number, clientIp?: string): Promise<CheckInResult> {
    const reservation = await this.reservationRepository.findById(reservationId)
    if (!reservation) {
      throw new ReservationError(404, "SPACE_NOT_FOUND", "Reservación no encontrada")
    }

    if (reservation.user_id !== userId) {
      throw new ReservationError(401, "UNAUTHORIZED", "No autorizado")
    }

    if (reservation.status !== "confirmada") {
      throw new ReservationError(422, "INVALID_STATUS", "La reservación no está en estado confirmada")
    }

    if (reservation.space_id === null) {
      throw new ReservationError(422, "INVALID_STATUS", "Las reservas solo de estacionamiento no requieren check-in")
    }

    this.validateCheckInIp(clientIp)

    const window = this.getCheckInWindow(
      reservation.reservation_date,
      reservation.start_time,
      reservation.grace_period_minutes
    )
    const now = this.getCurrentWallClockTime()

    if (now < window.opensAt) {
      throw new ReservationError(422, "CHECK_IN_NOT_AVAILABLE_YET", "El check-in estará disponible 15 minutos antes de la reservación")
    }

    if (now > window.closesAt) {
      throw new ReservationError(422, "CHECK_IN_WINDOW_CLOSED", "La ventana de check-in ya cerró")
    }

    await this.reservationRepository.update(reservationId, {
      status: "activa",
      check_in_time: new Date(),
    })

    const reservationDate = this.normalizeReservationDate(reservation.reservation_date)

    // Update streak
    const streak = this.streakRepository
      ? await this.streakRepository.upsertAfterCheckIn(userId, reservationDate)
      : { current_streak: 0, longest_streak: 0, last_check_in_date: null }

    // Evaluate check-in badges (soft failure)
    let newBadges: import("../interfaces").BadgeInfo[] = []
    if (this.badgeService) {
      try {
        newBadges = await this.badgeService.evaluateAfterCheckIn(userId, streak)
      } catch (err) {
        console.error("Badge evaluation failed (check-in still succeeded):", err)
      }
    }

    return { streak, newBadges }
  }

  private validateCheckInIp(clientIp?: string): void {
    const configuredCidrs = getAllowedCheckInCidrs()

    if (configuredCidrs.length === 0) {
      return
    }

    const normalizedIp = this.normalizeIpv4(clientIp)
    if (!normalizedIp) {
      throw new ReservationError(403, "CHECK_IN_OUTSIDE_ALLOWED_NETWORK", "No fue posible validar la red para realizar el check-in")
    }

    const isAllowed = configuredCidrs.some((cidr) => this.isIpInCidr(normalizedIp, cidr))
    if (!isAllowed) {
      throw new ReservationError(403, "CHECK_IN_OUTSIDE_ALLOWED_NETWORK", "El check-in solo puede realizarse dentro de la red permitida")
    }
  }

  private getCheckInWindow(reservationDate: string | Date, startTime: string, gracePeriodMinutes: number): {
    opensAt: number
    closesAt: number
  } {
    const start = this.toWallClockTimestamp(reservationDate, startTime)
    const effectiveGracePeriodMinutes = this.getEffectiveGracePeriodMinutes(gracePeriodMinutes)
    const opensOffsetMs = effectiveGracePeriodMinutes * 60 * 1000
    const closesOffsetMs = CHECK_IN_POST_START_MINUTES * 60 * 1000

    return {
      opensAt: start - opensOffsetMs,
      closesAt: start + closesOffsetMs,
    }
  }

  private getEffectiveGracePeriodMinutes(gracePeriodMinutes: number): number {
    const overrideMinutes = getCheckInWindowOverrideMinutes()
    if (overrideMinutes !== null) {
      return overrideMinutes
    }

    return gracePeriodMinutes
  }

  async expireMissedReservations(): Promise<void> {
    const today = new Date().toISOString().split("T")[0]
    const pendingReservations = await this.reservationRepository.findPendingCheckInCandidates(today)
    const now = this.getCurrentWallClockTime()

    await Promise.all(
      pendingReservations
        .filter((reservation) => {
          const window = this.getCheckInWindow(
            reservation.reservation_date,
            reservation.start_time,
            reservation.grace_period_minutes
          )
          return now > window.closesAt
        })
        .map((reservation) =>
          this.reservationRepository.update(reservation.id, {
            status: "no_show",
            check_in_time: reservation.check_in_time,
          })
        )
    )
  }

  async getRecommendations(filter: AvailabilityFilter, userId: number): Promise<RecommendationResult> {
    if (!filter.reservation_date || !filter.start_time || !filter.end_time) {
      throw new ReservationError(400, "MISSING_FIELDS", "Los campos reservation_date, start_time y end_time son requeridos")
    }

    if (filter.end_time <= filter.start_time) {
      throw new ReservationError(400, "INVALID_TIME_RANGE", "El tiempo de fin debe ser mayor al tiempo de inicio")
    }

    this.getAiProviderMetadata()

    const [
      availableSpaces,
      occupants,
      frequentNeighbors,
      predictedOccupancy,
      userPreferences,
      spaceDemandScores,
    ] = await Promise.all([
      this.spaceRepository.findAvailable(filter),
      this.reservationRepository.findCurrentOccupants(filter),
      this.reservationRepository.findFrequentNeighbors(userId),
      this.reservationRepository.findPredictedOccupancy(filter),
      this.reservationRepository.findUserPreferenceSignals(userId),
      this.reservationRepository.findSpaceDemandScores(filter),
    ])

    const recommendableSpaces = availableSpaces.filter((space) => this.isRecommendableIndividualDesk(space))
    const maxNeighborStrength = Math.max(1, ...Array.from(frequentNeighbors.values()))
    const maxSpacePreference = this.maxMapValue(userPreferences.spaces)
    const maxFloorPreference = this.maxMapValue(userPreferences.floors)
    const maxCategoryPreference = this.maxMapValue(userPreferences.categories)
    const topCategory = this.getTopPreference(userPreferences.categories)
    const baseConfidence = this.clamp(
      0.5 +
        Math.min(0.22, userPreferences.total_reservations * 0.018) +
        Math.min(0.16, frequentNeighbors.size * 0.025) +
        Math.min(0.12, occupants.length * 0.012),
      0.52,
      0.94
    )

    const rankedRecommendations: IntelligentRecommendation[] = recommendableSpaces
      .map((space) => {
        const reasons: string[] = []
        const signals: RecommendationSignal[] = []
        let nearbyUser: IntelligentRecommendation["nearby_user"] = null
        let weightedScore = 0
        let totalWeight = 0

        const addSignal = (label: string, value: string, weight: number, strength: number) => {
          const normalizedStrength = this.clamp(strength, 0, 1)
          weightedScore += normalizedStrength * weight
          totalWeight += weight
          if (normalizedStrength >= 0.18) {
            signals.push({
              label,
              value,
              weight: Math.round(weight * 100),
              strength: Number(normalizedStrength.toFixed(2)),
            })
          }
        }

        const matchingNeighbors = occupants
          .filter((occupant) => occupant.floor_id === space.floor_id && frequentNeighbors.has(occupant.user.id))
          .map((occupant) => ({
            occupant,
            relationshipStrength: frequentNeighbors.get(occupant.user.id) ?? 0,
            distance: this.distance(space.layout_cx, space.layout_cy, occupant.layout_cx, occupant.layout_cy),
          }))
          .sort((a, b) => {
            const aStrength = a.relationshipStrength / maxNeighborStrength
            const bStrength = b.relationshipStrength / maxNeighborStrength
            const aScore = aStrength * 0.58 + Math.max(0, 1 - a.distance / 0.42) * 0.42
            const bScore = bStrength * 0.58 + Math.max(0, 1 - b.distance / 0.42) * 0.42
            return bScore - aScore
          })

        const nearest = matchingNeighbors[0]
        if (nearest) {
          const relationshipSignal = this.clamp(nearest.relationshipStrength / maxNeighborStrength, 0, 1)
          const proximitySignal = this.clamp(1 - nearest.distance / 0.42, 0, 1)
          const collaboratorSignal = relationshipSignal * 0.58 + proximitySignal * 0.42
          nearbyUser = nearest.occupant.user
          addSignal(
            "Colaboración",
            `${nearbyUser.first_name} ${nearbyUser.last_name}, ${nearest.relationshipStrength} coincidencias históricas`,
            0.28,
            collaboratorSignal
          )
          reasons.push(`El modelo detectó afinidad con ${nearbyUser.first_name} ${nearbyUser.last_name} y un asiento cercano en el mapa`)
        } else {
          addSignal("Colaboración", "Sin colaborador frecuente cercano en este horario", 0.28, 0.08)
        }

        const exactSpacePreference = (userPreferences.spaces.get(space.id) ?? 0) / maxSpacePreference
        const floorPreference = (userPreferences.floors.get(space.floor_id) ?? 0) / maxFloorPreference
        const categoryPreference = space.priority_category
          ? (userPreferences.categories.get(space.priority_category) ?? 0) / maxCategoryPreference
          : 0
        const habitSignal = this.clamp(
          exactSpacePreference * 0.5 + floorPreference * 0.3 + categoryPreference * 0.2,
          0,
          1
        )
        addSignal(
          "Patrón personal",
          userPreferences.total_reservations > 0
            ? `${Math.round(habitSignal * 100)}% de afinidad por historial reciente`
            : "Historial insuficiente; se prioriza disponibilidad",
          0.22,
          userPreferences.total_reservations > 0 ? habitSignal : 0.35
        )
        if (habitSignal >= 0.42) {
          reasons.push("Coincide con patrones de piso, categoría o espacio que has usado recientemente")
        }

        const categoryMatch =
          filter.priority_category && space.priority_category === filter.priority_category
            ? 1
            : topCategory !== null && space.priority_category === topCategory
              ? 0.72
              : 0.42
        addSignal(
          "Tipo de espacio",
          filter.priority_category && space.priority_category === filter.priority_category
            ? "Coincide con el filtro seleccionado"
            : topCategory !== null && space.priority_category === topCategory
              ? "Similar a tu categoría más usada"
              : "Categoría disponible sin preferencia fuerte",
          0.12,
          categoryMatch
        )
        if (filter.priority_category && space.priority_category === filter.priority_category) {
          reasons.push("Respeta el tipo de espacio que filtraste")
        }

        const demandSignal = spaceDemandScores.get(space.id) ?? predictedOccupancy
        const availabilitySignal = this.clamp(1 - (demandSignal * 0.68 + predictedOccupancy * 0.32), 0, 1)
        addSignal(
          "Disponibilidad prevista",
          `${this.formatPercent(predictedOccupancy)} de ocupación estimada; ${this.formatPercent(demandSignal)} de presión histórica del asiento`,
          0.2,
          availabilitySignal
        )
        if (predictedOccupancy >= 0.7) {
          reasons.push("La IA prevé alta ocupación para esta franja, por eso prioriza asientos con menor presión histórica")
        } else if (predictedOccupancy <= 0.35) {
          reasons.push("La IA prevé baja ocupación, por eso optimiza comodidad y afinidad personal")
        }

        const nonFrequentOccupants = occupants.filter(
          (occupant) => occupant.floor_id === space.floor_id && !frequentNeighbors.has(occupant.user.id)
        )
        const nearestNonFrequentDistance = nonFrequentOccupants.reduce(
          (min, occupant) => Math.min(min, this.distance(space.layout_cx, space.layout_cy, occupant.layout_cx, occupant.layout_cy)),
          1
        )
        const quietnessSignal = nonFrequentOccupants.length === 0
          ? 0.72
          : this.clamp(nearestNonFrequentDistance / 0.46, 0.18, 1)
        addSignal(
          "Distribución del mapa",
          nonFrequentOccupants.length === 0
            ? "Zona despejada para el horario seleccionado"
            : "Evita concentración excesiva alrededor del asiento",
          0.12,
          quietnessSignal
        )

        const layoutSignal = space.layout_cx !== null && space.layout_cy !== null ? 0.78 : 0.45
        addSignal("Calidad de datos", "Coordenadas de mapa disponibles para scoring espacial", 0.06, layoutSignal)

        if (reasons.length === 0) {
          reasons.push("El modelo eligió este espacio por disponibilidad, distribución y señales de uso reciente")
        }

        const normalizedScore = totalWeight > 0 ? weightedScore / totalWeight : 0.5
        const score = Math.round(52 + normalizedScore * 46)
        const confidence = this.clamp(
          baseConfidence + Math.min(0.04, signals.length * 0.008) + (nearest ? 0.03 : 0),
          0.52,
          0.96
        )
        const aiSummary = nearest
          ? `Recomendado por colaboración cercana y ${Math.round(normalizedScore * 100)}% de ajuste al contexto.`
          : `Recomendado por ${Math.round(normalizedScore * 100)}% de ajuste entre historial, demanda y disponibilidad.`

        return {
          space,
          score,
          confidence: Number(confidence.toFixed(2)),
          ai_summary: aiSummary,
          reasons,
          signals: signals.sort((a, b) => (b.strength * b.weight) - (a.strength * a.weight)).slice(0, 4),
          nearby_user: nearbyUser,
          predicted_occupancy: predictedOccupancy,
        }
      })
      .sort((a, b) => b.score - a.score)

    const candidatePool = filter.floor_id === undefined
      ? this.pickDiverseFloorRecommendations(rankedRecommendations, Math.min(24, rankedRecommendations.length))
      : rankedRecommendations.slice(0, 24)
    const aiDecision = await this.getAiRecommendationDecision(filter, userId, candidatePool, predictedOccupancy)
    const aiRecommendations = this.applyAiRecommendationDecision(candidatePool, aiDecision).slice(0, 6)

    const result: RecommendationResult = {
      model: {
        name: `${RECOMMENDATION_MODEL_NAME} + ${this.getAiProviderMetadata().label}`,
        version: `${RECOMMENDATION_MODEL_VERSION}:${this.getAiProviderMetadata().model}`,
        confidence: aiRecommendations.length > 0
          ? Number((aiRecommendations.slice(0, 3).reduce((sum, item) => sum + item.confidence, 0) / Math.min(3, aiRecommendations.length)).toFixed(2))
          : 0,
        factors: RECOMMENDATION_FACTORS,
      },
      predicted_occupancy: this.clamp(aiDecision.predicted_occupancy ?? predictedOccupancy, 0, 1),
      prediction_label:
        aiDecision.prediction_label ??
        (predictedOccupancy >= 0.7 ? "alta" :
        predictedOccupancy >= 0.4 ? "media" :
        "baja"),
      recommendations: aiRecommendations,
    }

    return result
  }

  async answerAssistantQuestion(
    message: string,
    userId: number,
    userRole: string
  ): Promise<AssistantResponse> {
    const normalized = this.normalizeQuestion(message)
    const filter = this.buildAssistantDefaultFilter(normalized)
    const isAdmin = ["admin", "administrador"].includes(userRole.toLowerCase())
    const isGuard = ["guard", "guardia"].includes(userRole.toLowerCase())
    const wantsRecommendation = this.matchesAny(normalized, ["recomienda", "recomendacion", "recomendación", "sentar", "siento", "espacio", "lugar", "ia"])
    const wantsAdmin = this.matchesAny(normalized, ["kpi", "ocupacion", "ocupación", "dashboard", "admin", "bloqueo", "bloquear"])
    const currentReservations = await this.reservationRepository.findByUserId(userId, "current")
    const recommendations = wantsRecommendation
      ? await this.getRecommendations(filter, userId)
      : null
    const overview = wantsAdmin && isAdmin
      ? await this.reservationRepository.getAdminOverview(filter.reservation_date)
      : null

    const compactRecommendations = recommendations?.recommendations.slice(0, 4).map((item) => ({
      space_id: item.space.id,
      space_number: item.space.space_number,
      floor_id: item.space.floor_id,
      score: item.score,
      reason: item.ai_summary,
    })) ?? []

    const context = JSON.stringify({
      user: { id: userId, role: userRole, is_admin: isAdmin, is_guard: isGuard },
      question: message,
      inferred_filter: filter,
      current_reservations: currentReservations.slice(0, 5).map((reservation) => ({
        space_number: reservation.space_number,
        floor_name: reservation.floor_name,
        reservation_date: String(reservation.reservation_date).slice(0, 10),
        start_time: String(reservation.start_time).slice(0, 5),
        end_time: String(reservation.end_time).slice(0, 5),
        status: reservation.status,
        parking_spot_number: reservation.parking_spot_number,
        parking_zone_name: reservation.parking_zone_name,
      })),
      recommendations: compactRecommendations,
      admin_overview: overview
        ? {
            total_reservations: overview.total_reservations,
            occupancy_rate: overview.occupancy_rate,
            parking_reservations: overview.parking_reservations,
            blocked_area_count: overview.blocked_area_count,
            blocked_space_count: overview.blocked_space_count,
          }
        : null,
    })

    const decision = await this.callAiJson<AiAssistantDecision>({
      instructions:
        "Eres Gemini actuando como chatbot real de WorkHub MTY. Responde en español, breve y accionable. Usa SOLO el JSON de contexto recibido; no uses conocimiento externo, memoria previa, ejemplos ni datos inventados. Si el contexto no contiene la respuesta, dilo explícitamente. Devuelve SOLO JSON valido con answer, confidence 0-1, intent y actions. No inventes reservas, espacios, horarios, usuarios, KPIs ni estacionamientos.",
      input: context,
      maxOutputTokens: 700,
      responseSchema: this.getAssistantResponseSchema(),
    })

    const assistantAnswer = typeof decision.answer === "string" ? decision.answer.trim() : ""
    const assistantConfidence = typeof decision.confidence === "number" ? decision.confidence : Number.NaN
    const assistantIntent = this.normalizeAssistantIntent(decision.intent)
    const assistantActions = Array.isArray(decision.actions)
      ? decision.actions
          .filter((action) => typeof action.label === "string" && typeof action.to === "string")
          .map((action) => ({ label: action.label.trim(), to: action.to.trim() }))
          .filter((action) => action.label.length > 0 && action.to.length > 0)
          .slice(0, 2)
      : null

    if (
      assistantAnswer.length === 0 ||
      Number.isNaN(assistantConfidence) ||
      !assistantIntent ||
      assistantActions === null
    ) {
      throw new ReservationError(502, "AI_PROVIDER_ERROR", "Gemini devolvió una respuesta inválida")
    }

    return {
      answer: assistantAnswer,
      confidence: Number(this.clamp(assistantConfidence, 0, 1).toFixed(2)),
      intent: assistantIntent,
      recommendations: compactRecommendations,
      actions: assistantActions,
    }
  }

  private normalizeQuestion(message: string): string {
    return message
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  }

  private matchesAny(message: string, terms: string[]): boolean {
    return terms.some((term) => message.includes(this.normalizeQuestion(term)))
  }

  private buildAssistantDefaultFilter(message: string): AvailabilityFilter {
    const now = new Date()
    const date = this.formatDateParts(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate()
    )
    const parsedHour = this.parseRequestedHour(message)
    const startHour = parsedHour ?? Math.min(17, Math.max(8, now.getHours() + 1))
    const endHour = Math.min(18, startHour + 1)

    return {
      reservation_date: date,
      start_time: `${String(startHour).padStart(2, "0")}:00`,
      end_time: `${String(endHour).padStart(2, "0")}:00`,
      ...(message.includes("piso 9") ? { floor_id: 9 } : {}),
      ...(message.includes("piso 3") ? { floor_id: 3 } : {}),
      ...(message.includes("planta baja") || message.includes(" pb ") ? { floor_id: 0 } : {}),
    }
  }

  private parseRequestedHour(message: string): number | null {
    const match = message.match(/(?:a las|desde|hora)?\s*(\d{1,2})(?::\d{2})?\s*(am|pm)?/)
    if (!match) return null
    let hour = Number(match[1])
    const meridiem = match[2]
    if (Number.isNaN(hour)) return null
    if (meridiem === "pm" && hour < 12) hour += 12
    if (meridiem === "am" && hour === 12) hour = 0
    return hour >= 7 && hour <= 21 ? hour : null
  }

  private async getAiRecommendationDecision(
    filter: AvailabilityFilter,
    userId: number,
    candidates: IntelligentRecommendation[],
    predictedOccupancy: number
  ): Promise<AiRecommendationDecision> {
    const input = JSON.stringify({
      user_id: userId,
      reservation: filter,
      predicted_occupancy: predictedOccupancy,
      candidates: candidates.map((item) => ({
        space_id: item.space.id,
        space_number: item.space.space_number,
        floor_id: item.space.floor_id,
        category: item.space.priority_category,
        local_score: item.score,
        local_confidence: item.confidence,
        nearby_user: item.nearby_user
          ? {
              first_name: item.nearby_user.first_name,
              last_name: item.nearby_user.last_name,
              department: item.nearby_user.department,
            }
          : null,
        local_reasons: item.reasons.slice(0, 3),
        signals: item.signals.map((signal) => ({
          label: signal.label,
          strength: signal.strength,
          value: signal.value,
        })),
      })),
    })

    const decision = await this.callAiJson<AiRecommendationDecision>({
      instructions:
        "Eres Gemini actuando como IA real de recomendaciones de WorkHub MTY. Elige hasta 6 escritorios individuales reales de candidates para el mapa. Usa SOLO el JSON de candidates recibido; no uses conocimiento externo, memoria previa, ejemplos ni datos inventados. No recomiendes salas, areas colaborativas, phone booths, work labs ni estacionamientos. Si no hay candidates, devuelve recommendations vacio. Responde SOLO JSON valido con predicted_occupancy, prediction_label y recommendations. prediction_label debe ser exactamente baja, media o alta. Cada recommendation debe incluir space_id, reason breve en español, score 0-100 y confidence 0-1. No inventes IDs.",
      input,
      maxOutputTokens: 900,
      responseSchema: this.getRecommendationResponseSchema(),
    })

    const normalizedPredictionLabel = this.normalizePredictionLabel(decision.prediction_label)
    if (
      typeof decision.predicted_occupancy !== "number" ||
      !normalizedPredictionLabel ||
      !Array.isArray(decision.recommendations)
    ) {
      throw new ReservationError(502, "AI_PROVIDER_ERROR", "Gemini devolvió recomendaciones inválidas")
    }

    return {
      predicted_occupancy: decision.predicted_occupancy,
      prediction_label: normalizedPredictionLabel,
      recommendations: decision.recommendations
        .filter((item) =>
          Number.isFinite(Number(item.space_id)) &&
          typeof item.reason === "string" &&
          item.reason.trim().length > 0 &&
          typeof item.score === "number" &&
          typeof item.confidence === "number"
        )
        .map((item) => ({
          space_id: Number(item.space_id),
          reason: item.reason.trim(),
          score: item.score,
          confidence: item.confidence,
        })),
    }
  }

  private applyAiRecommendationDecision(
    candidates: IntelligentRecommendation[],
    decision: AiRecommendationDecision
  ): IntelligentRecommendation[] {
    const byId = new Map(candidates.map((item) => [item.space.id, item]))
    const selected: IntelligentRecommendation[] = []

    for (const choice of decision.recommendations) {
      const candidate = byId.get(Number(choice.space_id))
      if (!candidate || selected.some((item) => item.space.id === candidate.space.id)) continue

      selected.push({
        ...candidate,
        score: this.clamp(Math.round(choice.score), 0, 100),
        confidence: Number(this.clamp(choice.confidence, 0.52, 0.98).toFixed(2)),
        ai_summary: choice.reason,
        reasons: [choice.reason, ...candidate.reasons.filter((item) => item !== choice.reason)].slice(0, 4),
      })
    }

    return selected
  }

  private isRecommendableIndividualDesk(space: Space): boolean {
    return (
      space.is_active &&
      !space.visual_only &&
      space.priority_category === "escritorio" &&
      space.layout_type === "desk"
    )
  }

  private getAiProviderMetadata(): AiProviderMetadata {
    const configuredProvider = process.env.AI_PROVIDER?.trim().toLowerCase()
    if (
      configuredProvider &&
      !["gemini", "google"].includes(configuredProvider)
    ) {
      throw new ReservationError(503, "AI_NOT_CONFIGURED", "AI_PROVIDER debe ser gemini")
    }

    if (!process.env.GEMINI_API_KEY?.trim()) {
      throw new ReservationError(503, "AI_NOT_CONFIGURED", "Configura GEMINI_API_KEY para usar IA real con Gemini")
    }

    return {
      name: "gemini",
      label: "Gemini API",
      model: process.env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL,
    }
  }

  private async callAiJson<T>(request: {
    instructions: string
    input: string
    maxOutputTokens: number
    responseSchema?: AiJsonSchema
  }): Promise<T> {
    const provider = this.getAiProviderMetadata()

    return this.callGeminiJson<T>(request, provider.model)
  }

  private async callGeminiJson<T>({
    instructions,
    input,
    maxOutputTokens,
    responseSchema,
  }: {
    instructions: string
    input: string
    maxOutputTokens: number
    responseSchema?: AiJsonSchema
  }, model: string): Promise<T> {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      throw new ReservationError(503, "AI_NOT_CONFIGURED", "Configura GEMINI_API_KEY para usar IA real con Gemini")
    }

    const baseUrl = (process.env.GEMINI_BASE_URL?.trim() || GEMINI_DEFAULT_BASE_URL).replace(/\/+$/, "")
    const models = this.getGeminiModelChain(model)
    let lastErrorBody: unknown = null
    let lastParseError: unknown = null

    for (const candidateModel of models) {
      const response = await globalThis.fetch(`${baseUrl}/models/${encodeURIComponent(candidateModel)}:generateContent`, {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: instructions }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: input }],
            },
          ],
          generationConfig: {
            maxOutputTokens,
            responseMimeType: "application/json",
            ...(responseSchema ? { responseSchema } : {}),
            thinkingConfig: {
              thinkingBudget: 0,
            },
            temperature: 0.2,
          },
        }),
      })

      const body = await response.json().catch(() => null) as unknown
      if (!response.ok) {
        lastErrorBody = body
        if (this.shouldTryNextGeminiModel(response.status)) {
          continue
        }

        console.error("Gemini provider error:", body)
        throw new ReservationError(502, "AI_PROVIDER_ERROR", "No fue posible consultar Gemini")
      }

      const text = this.extractGeminiText(body)
      if (!text) {
        lastErrorBody = body
        continue
      }

      try {
        return this.parseAiJson<T>(text)
      } catch (error) {
        lastParseError = { error, text }
      }
    }

    console.error("Gemini provider error:", lastErrorBody ?? lastParseError)
    throw new ReservationError(502, "AI_PROVIDER_ERROR", "No fue posible consultar Gemini")
  }

  private getGeminiModelChain(primaryModel: string): string[] {
    const configuredFallbacks = process.env.GEMINI_FALLBACK_MODELS
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean)

    const fallbackModels = configuredFallbacks && configuredFallbacks.length > 0
      ? configuredFallbacks
      : ["gemini-2.5-flash", "gemini-2.0-flash-lite"]

    return Array.from(new Set([primaryModel, ...fallbackModels]))
  }

  private shouldTryNextGeminiModel(statusCode: number): boolean {
    return statusCode === 429 || statusCode === 503
  }

  private extractGeminiText(body: unknown): string {
    const response = body as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string
          }>
        }
      }>
    }

    return response.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text)
      .filter((text): text is string => typeof text === "string")
      .join("\n")
      .trim() ?? ""
  }

  private stripJsonFence(text: string): string {
    return text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()
  }

  private parseAiJson<T>(text: string): T {
    const compacted = this.stripJsonFence(text)
      .replace(/,\s*([}\]])/g, "$1")
      .trim()

    try {
      return JSON.parse(compacted) as T
    } catch {
      const firstObject = compacted.indexOf("{")
      const lastObject = compacted.lastIndexOf("}")
      if (firstObject >= 0 && lastObject > firstObject) {
        return JSON.parse(compacted.slice(firstObject, lastObject + 1)) as T
      }

      throw new Error("AI response is not valid JSON")
    }
  }

  private normalizePredictionLabel(label: unknown): AiRecommendationDecision["prediction_label"] | undefined {
    if (label === "baja" || label === "media" || label === "alta") return label
    if (typeof label !== "string") return undefined

    const normalized = this.normalizeQuestion(label)
    if (normalized.includes("alta")) return "alta"
    if (normalized.includes("media")) return "media"
    if (normalized.includes("baja")) return "baja"
    return undefined
  }

  private normalizeAssistantIntent(intent: unknown): AssistantResponse["intent"] | null {
    if (
      intent === "reservation_status" ||
      intent === "recommendation" ||
      intent === "admin_insight" ||
      intent === "parking" ||
      intent === "general"
    ) {
      return intent
    }

    return null
  }

  private getRecommendationResponseSchema(): AiJsonSchema {
    return {
      type: "object",
      properties: {
        predicted_occupancy: { type: "number" },
        prediction_label: { type: "string", enum: ["baja", "media", "alta"] },
        recommendations: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              space_id: { type: "integer" },
              reason: { type: "string" },
              score: { type: "number" },
              confidence: { type: "number" },
            },
            required: ["space_id", "reason", "score", "confidence"],
          },
        },
      },
      required: ["predicted_occupancy", "prediction_label", "recommendations"],
    }
  }

  private getAssistantResponseSchema(): AiJsonSchema {
    return {
      type: "object",
      properties: {
        answer: { type: "string" },
        confidence: { type: "number" },
        intent: {
          type: "string",
          enum: ["reservation_status", "recommendation", "admin_insight", "parking", "general"],
        },
        actions: {
          type: "array",
          maxItems: 2,
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              to: { type: "string" },
            },
            required: ["label", "to"],
          },
        },
      },
      required: ["answer", "confidence", "intent", "actions"],
    }
  }

  private distance(ax: number | null, ay: number | null, bx: number | null, by: number | null): number {
    if (ax == null || ay == null || bx == null || by == null) return 1
    return Math.hypot(ax - bx, ay - by)
  }

  private pickDiverseFloorRecommendations(
    rankedRecommendations: IntelligentRecommendation[],
    limit: number
  ): IntelligentRecommendation[] {
    if (rankedRecommendations.length <= limit) return rankedRecommendations

    const byFloor = new Map<number, IntelligentRecommendation[]>()
    for (const recommendation of rankedRecommendations) {
      const list = byFloor.get(recommendation.space.floor_id) ?? []
      list.push(recommendation)
      byFloor.set(recommendation.space.floor_id, list)
    }

    const selected = new Map<number, IntelligentRecommendation>()
    const floorLeaders = Array.from(byFloor.values())
      .map((items) => items[0])
      .sort((a, b) => b.score - a.score)

    for (const recommendation of floorLeaders) {
      if (selected.size >= limit) break
      selected.set(recommendation.space.id, recommendation)
    }

    for (const recommendation of rankedRecommendations) {
      if (selected.size >= limit) break
      if (!selected.has(recommendation.space.id)) {
        selected.set(recommendation.space.id, recommendation)
      }
    }

    return Array.from(selected.values()).sort((a, b) => b.score - a.score)
  }

  private maxMapValue(map: Map<unknown, number>): number {
    return Math.max(1, ...Array.from(map.values()))
  }

  private getTopPreference<T>(map: Map<T, number>): T | null {
    let topKey: T | null = null
    let topValue = 0
    for (const [key, value] of map.entries()) {
      if (value > topValue) {
        topKey = key
        topValue = value
      }
    }
    return topKey
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  private formatPercent(value: number): string {
    return `${Math.round(this.clamp(value, 0, 1) * 100)}%`
  }

  private getCurrentWallClockTime(): number {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: DEFAULT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })

    const parts = formatter.formatToParts(new Date())
    const get = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((part) => part.type === type)?.value ?? "0")

    return Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second")
    )
  }

  private toWallClockTimestamp(date: string | Date, time: string): number {
    const normalizedDate = this.normalizeReservationDate(date)
    const [year, month, day] = normalizedDate.split("-").map(Number)
    const [hour, minute] = time.split(":").map(Number)

    return Date.UTC(year, month - 1, day, hour, minute, 0)
  }

  private normalizeReservationDate(date: string | Date): string {
    if (date instanceof Date) {
      return this.formatDateParts(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate()
      )
    }

    const trimmed = String(date).trim()
    if (trimmed.includes("T")) {
      return trimmed.slice(0, 10)
    }

    return trimmed
  }

  private formatDateParts(year: number, month: number, day: number): string {
    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
  }

  private normalizeIpv4(clientIp?: string): string | null {
    if (!clientIp) return null

    if (clientIp.includes(",")) {
      return this.normalizeIpv4(clientIp.split(",")[0]?.trim())
    }

    const normalized = clientIp.trim()
    if (normalized.startsWith("::ffff:")) {
      return normalized.slice(7)
    }

    if (normalized === "::1") {
      return "127.0.0.1"
    }

    return /^\d{1,3}(\.\d{1,3}){3}$/.test(normalized) ? normalized : null
  }

  private isIpInCidr(ip: string, cidr: string): boolean {
    const [network, maskText] = cidr.split("/")
    const maskBits = Number(maskText)

    if (!network || Number.isNaN(maskBits) || maskBits < 0 || maskBits > 32) {
      return false
    }

    const ipInt = this.ipv4ToInt(ip)
    const networkInt = this.ipv4ToInt(network)
    if (ipInt === null || networkInt === null) {
      return false
    }

    if (maskBits === 0) {
      return true
    }

    const mask = (0xffffffff << (32 - maskBits)) >>> 0
    return (ipInt & mask) === (networkInt & mask)
  }

  private ipv4ToInt(ip: string): number | null {
    const octets = ip.split(".").map(Number)
    if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
      return null
    }

    return (((octets[0] << 24) >>> 0) +
      ((octets[1] << 16) >>> 0) +
      ((octets[2] << 8) >>> 0) +
      (octets[3] >>> 0)) >>> 0
  }

  private async generateUniqueCode(): Promise<string> {
    while (true) {
      let code = ""
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
      }
      const existing = await this.reservationRepository.findByCode(code)
      if (!existing) return code
    }
  }
}
