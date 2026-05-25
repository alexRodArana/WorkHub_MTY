import { Request, Response } from "express"
import { ReservationService } from "../services/ReservationService"
import { ReservationRepository } from "../repositories/ReservationRepository"
import { StreakRepository } from "../repositories/StreakRepository"
import { BadgeService } from "../services/BadgeService"
import { ReservationError } from "../errors"
import { ReservationEventHub } from "../realtime/ReservationEventHub"
import type { PriorityCategory } from "../interfaces"
import type { AuthRequest } from "../../shared/auth"

const VALID_PRIORITY_CATEGORIES = new Set<PriorityCategory>([
  "escritorio", "colaborativo", "work_lab", "phone_booth", "garage",
])

export class ReservationController {
  constructor(
    private readonly reservationService: ReservationService,
    private readonly reservationRepository: ReservationRepository,
    private readonly streakRepository: StreakRepository,
    private readonly badgeService: BadgeService,
    private readonly eventHub?: ReservationEventHub,
  ) {}

  async getAvailability(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const { reservation_date, start_time, end_time, floor_id, priority_category } = req.query

      if (!reservation_date || !start_time || !end_time) {
        res.status(400).json({
          error: "MISSING_FIELDS",
          message: "Los campos reservation_date, start_time y end_time son requeridos",
        })
        return
      }

      const parsedCategory = priority_category !== undefined ? String(priority_category) : undefined
      if (parsedCategory !== undefined && !VALID_PRIORITY_CATEGORIES.has(parsedCategory as PriorityCategory)) {
        res.status(400).json({ error: "INVALID_CATEGORY", message: "Categoría de espacio inválida" })
        return
      }

      const filter = {
        reservation_date: String(reservation_date),
        start_time: String(start_time),
        end_time: String(end_time),
        ...(floor_id !== undefined ? { floor_id: Number(floor_id) } : {}),
        ...(parsedCategory !== undefined ? { priority_category: parsedCategory as PriorityCategory } : {}),
      }

      const spaces = await this.reservationService.checkAvailability(filter, userId)
      res.status(200).json(spaces)
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      console.error("INTERNAL_ERROR detail:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async getRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const { reservation_date, start_time, end_time, floor_id, priority_category } = req.query

      if (!reservation_date || !start_time || !end_time) {
        res.status(400).json({
          error: "MISSING_FIELDS",
          message: "Los campos reservation_date, start_time y end_time son requeridos",
        })
        return
      }

      const parsedCategory = priority_category !== undefined ? String(priority_category) : undefined
      if (parsedCategory !== undefined && !VALID_PRIORITY_CATEGORIES.has(parsedCategory as PriorityCategory)) {
        res.status(400).json({ error: "INVALID_CATEGORY", message: "Categoría de espacio inválida" })
        return
      }

      const result = await this.reservationService.getRecommendations({
        reservation_date: String(reservation_date),
        start_time: String(start_time),
        end_time: String(end_time),
        ...(floor_id !== undefined ? { floor_id: Number(floor_id) } : {}),
        ...(parsedCategory !== undefined ? { priority_category: parsedCategory as PriorityCategory } : {}),
      }, userId)

      res.json(result)
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      console.error("INTERNAL_ERROR detail:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async createReservation(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const result = await this.reservationService.createReservation(req.body, userId)
      await this.reservationRepository.addAuditLog?.({
        actorUserId: userId,
        action: "reservation.created",
        entityType: "reservation",
        entityId: result.reservation_id,
        metadata: {
          space_id: result.space_id,
          reservation_date: result.reservation_date,
          start_time: result.start_time,
          end_time: result.end_time,
          parking: result.parking_spot !== null || result.requiere_estacionamiento,
        },
      })
      if (this.eventHub) {
        const eventDetails = await this.reservationRepository.findEventDetails(result.reservation_id)
        this.eventHub.publish({
          type: "reservation.created",
          actor_user_id: userId,
          reservation_id: result.reservation_id,
          reservation_date: eventDetails?.reservation_date ?? result.reservation_date,
          floor_id: eventDetails?.floor_id,
          space_id: eventDetails?.space_id ?? result.space_id,
          parking: eventDetails?.parking ?? (result.parking_spot !== null || result.requiere_estacionamiento),
        })
      }
      res.status(201).json(result)
    } catch (err) {
      if (err instanceof ReservationError) {
        if (err.statusCode >= 500) console.error("ReservationError 500:", err)
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      console.error("INTERNAL_ERROR detail:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async getFloorOccupancy(req: Request, res: Response): Promise<void> {
    try {
      const { reservation_date, floor_id } = req.query

      if (!reservation_date || floor_id === undefined) {
        res.status(400).json({
          error: "MISSING_FIELDS",
          message: "Los campos reservation_date y floor_id son requeridos",
        })
        return
      }

      const floorId = Number(floor_id)
      if (!Number.isInteger(floorId)) {
        res.status(400).json({ error: "INVALID_ID", message: "ID de piso inválido" })
        return
      }

      const occupancy = await this.reservationRepository.findOccupancyByFloor(
        floorId,
        String(reservation_date)
      )
      res.status(200).json(occupancy)
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      console.error("INTERNAL_ERROR detail:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async checkIn(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const reservationId = parseInt(req.params.id, 10)

      if (isNaN(reservationId)) {
        res.status(400).json({ error: "INVALID_ID", message: "ID de reservación inválido" })
        return
      }

      const forwardedFor = req.headers["x-forwarded-for"]
      const clientIp = typeof forwardedFor === "string" ? forwardedFor : req.ip

      const result = await this.reservationService.checkIn(reservationId, userId, clientIp)
      await this.reservationRepository.addAuditLog?.({
        actorUserId: userId,
        action: "reservation.checked_in",
        entityType: "reservation",
        entityId: reservationId,
      })
      if (this.eventHub) {
        const eventDetails = await this.reservationRepository.findEventDetails(reservationId)
        this.eventHub.publish({
          type: "reservation.checked_in",
          actor_user_id: userId,
          reservation_id: reservationId,
          reservation_date: eventDetails?.reservation_date,
          floor_id: eventDetails?.floor_id,
          space_id: eventDetails?.space_id ?? null,
          parking: eventDetails?.parking ?? false,
        })
      }
      res.status(200).json({ message: "Check-in realizado", ...result })
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      console.error("INTERNAL_ERROR detail:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async cancelReservation(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const reservationId = parseInt(req.params.id, 10)

      if (isNaN(reservationId)) {
        res.status(400).json({ error: "INVALID_ID", message: "ID de reservación inválido" })
        return
      }

      const eventDetails = this.eventHub
        ? await this.reservationRepository.findEventDetails(reservationId)
        : null
      await this.reservationService.cancelReservation(reservationId, userId)
      await this.reservationRepository.addAuditLog?.({
        actorUserId: userId,
        action: "reservation.cancelled",
        entityType: "reservation",
        entityId: reservationId,
      })
      this.eventHub?.publish({
        type: "reservation.cancelled",
        actor_user_id: userId,
        reservation_id: reservationId,
        reservation_date: eventDetails?.reservation_date,
        floor_id: eventDetails?.floor_id,
        space_id: eventDetails?.space_id ?? null,
        parking: eventDetails?.parking ?? false,
      })
      res.status(200).json({ message: "Reservación cancelada" })
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      console.error("INTERNAL_ERROR detail:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async getMyReservations(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const status = typeof req.query.status === "string" ? req.query.status : undefined
      await this.reservationService.expireMissedReservations()
      const reservations = await this.reservationRepository.findByUserId(userId, status)
      res.json(reservations)
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async getMyStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const [streak, badges] = await Promise.all([
        this.streakRepository.findByUserId(userId),
        this.badgeService.findEarnedWithStatus(userId),
      ])
      res.json({
        streak: streak ?? { current_streak: 0, longest_streak: 0, last_check_in_date: null },
        badges,
      })
    } catch (err) {
      console.error("getMyStats error:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async getMyVehicles(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      res.json(await this.reservationRepository.findVehiclesByUser(userId))
    } catch (err) {
      console.error("getMyVehicles error:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async createVehicle(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const plate = typeof req.body?.plate === "string" ? req.body.plate.trim() : ""
      if (plate.length < 4 || plate.length > 20) {
        res.status(400).json({ error: "INVALID_VEHICLE", message: "La placa debe tener entre 4 y 20 caracteres" })
        return
      }

      const vehicle = await this.reservationRepository.createVehicle(userId, {
        plate,
        alias: typeof req.body?.alias === "string" ? req.body.alias : null,
        make: typeof req.body?.make === "string" ? req.body.make : null,
        model: typeof req.body?.model === "string" ? req.body.model : null,
        color: typeof req.body?.color === "string" ? req.body.color : null,
        is_default: req.body?.is_default === true,
      })
      await this.reservationRepository.addAuditLog?.({
        actorUserId: userId,
        action: "vehicle.created",
        entityType: "user_vehicle",
        entityId: vehicle.id,
        metadata: { plate: vehicle.plate },
      })
      res.status(201).json(vehicle)
    } catch (err) {
      const pgErr = err as { code?: string }
      if (pgErr.code === "23505") {
        res.status(409).json({ error: "INVALID_VEHICLE", message: "Ya existe un vehículo con esa placa en tu perfil" })
        return
      }
      console.error("createVehicle error:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async updateVehicle(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const vehicleId = Number(req.params.id)
      const plate = typeof req.body?.plate === "string" ? req.body.plate.trim() : ""
      if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
        res.status(400).json({ error: "INVALID_ID", message: "ID de vehículo inválido" })
        return
      }
      if (plate.length < 4 || plate.length > 20) {
        res.status(400).json({ error: "INVALID_VEHICLE", message: "La placa debe tener entre 4 y 20 caracteres" })
        return
      }

      const vehicle = await this.reservationRepository.updateVehicle(userId, vehicleId, {
        plate,
        alias: typeof req.body?.alias === "string" ? req.body.alias : null,
        make: typeof req.body?.make === "string" ? req.body.make : null,
        model: typeof req.body?.model === "string" ? req.body.model : null,
        color: typeof req.body?.color === "string" ? req.body.color : null,
        is_default: req.body?.is_default === true,
      })
      if (!vehicle) {
        res.status(404).json({ error: "VEHICLE_NOT_FOUND", message: "Vehículo no encontrado" })
        return
      }
      await this.reservationRepository.addAuditLog?.({
        actorUserId: userId,
        action: "vehicle.updated",
        entityType: "user_vehicle",
        entityId: vehicle.id,
        metadata: { plate: vehicle.plate, is_default: vehicle.is_default },
      })
      res.json(vehicle)
    } catch (err) {
      const pgErr = err as { code?: string }
      if (pgErr.code === "23505") {
        res.status(409).json({ error: "INVALID_VEHICLE", message: "Ya existe un vehículo con esa placa en tu perfil" })
        return
      }
      console.error("updateVehicle error:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async setDefaultVehicle(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const vehicleId = Number(req.params.id)
      if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
        res.status(400).json({ error: "INVALID_ID", message: "ID de vehículo inválido" })
        return
      }
      const vehicle = await this.reservationRepository.setDefaultVehicle(userId, vehicleId)
      if (!vehicle) {
        res.status(404).json({ error: "VEHICLE_NOT_FOUND", message: "Vehículo no encontrado" })
        return
      }
      await this.reservationRepository.addAuditLog?.({
        actorUserId: userId,
        action: "vehicle.default_set",
        entityType: "user_vehicle",
        entityId: vehicle.id,
        metadata: { plate: vehicle.plate },
      })
      res.json(vehicle)
    } catch (err) {
      console.error("setDefaultVehicle error:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

  async deleteVehicle(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).userId
      const vehicleId = Number(req.params.id)
      if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
        res.status(400).json({ error: "INVALID_ID", message: "ID de vehículo inválido" })
        return
      }
      const deleted = await this.reservationRepository.deactivateVehicle(userId, vehicleId)
      if (!deleted) {
        res.status(409).json({
          error: "INVALID_VEHICLE",
          message: "No se puede eliminar un vehículo con reservas activas o futuras",
        })
        return
      }
      await this.reservationRepository.addAuditLog?.({
        actorUserId: userId,
        action: "vehicle.deleted",
        entityType: "user_vehicle",
        entityId: vehicleId,
      })
      res.json({ status: "deleted" })
    } catch (err) {
      console.error("deleteVehicle error:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }

}
