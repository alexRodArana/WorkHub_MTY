import { Request, Response } from "express"
import { ReservationRepository } from "../repositories/ReservationRepository"
import { ReservationError } from "../errors"
import { ReservationEventHub } from "../realtime/ReservationEventHub"
import type { PriorityCategory } from "../interfaces"
import type { AuthRequest } from "../../shared/auth"

const VALID_PRIORITY_CATEGORIES = new Set<PriorityCategory>([
  "escritorio", "colaborativo", "work_lab", "phone_booth", "garage",
])

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isTime(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value)
}

export class AdminController {
  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly eventHub?: ReservationEventHub
  ) {}

  async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const fallbackDate = typeof req.query.date === "string"
        ? req.query.date
        : new Date().toISOString().slice(0, 10)
      const dateFrom = typeof req.query.date_from === "string" ? req.query.date_from : fallbackDate
      const dateTo = typeof req.query.date_to === "string" ? req.query.date_to : dateFrom

      if (!isIsoDate(dateFrom) || !isIsoDate(dateTo) || dateTo < dateFrom) {
        res.status(400).json({ error: "INVALID_DATE_RANGE", message: "Rango de fechas inválido" })
        return
      }

      res.json(await this.reservationRepository.getAdminOverview(dateFrom, dateTo))
    } catch (err) {
      this.handleError(err, res)
    }
  }

  async blockArea(req: Request, res: Response): Promise<void> {
    try {
      const floorId = Number(req.body?.floor_id)
      const category = String(req.body?.priority_category ?? "")
      const reason = typeof req.body?.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim()
        : null

      if (!Number.isInteger(floorId) || !VALID_PRIORITY_CATEGORIES.has(category as PriorityCategory)) {
        res.status(400).json({ error: "INVALID_AREA", message: "Área inválida" })
        return
      }

      const block = await this.reservationRepository.blockArea(floorId, category as PriorityCategory, reason)
      await this.reservationRepository.addAuditLog?.({
        actorUserId: (req as AuthRequest).userId,
        action: "area_block.created",
        entityType: "area_block",
        entityId: block.id,
        metadata: { floor_id: block.floor_id, priority_category: block.priority_category, reason },
      })
      this.eventHub?.publish({
        type: "area_block.created",
        floor_id: block.floor_id,
      })
      res.status(201).json(block)
    } catch (err) {
      this.handleError(err, res)
    }
  }

  async unblockArea(req: Request, res: Response): Promise<void> {
    try {
      const blockId = Number(req.params.id)
      if (!Number.isInteger(blockId)) {
        res.status(400).json({ error: "INVALID_ID", message: "ID inválido" })
        return
      }

      const updated = await this.reservationRepository.unblockArea(blockId)
      if (!updated) {
        res.status(404).json({ error: "NOT_FOUND", message: "Bloqueo no encontrado" })
        return
      }

      await this.reservationRepository.addAuditLog?.({
        actorUserId: (req as AuthRequest).userId,
        action: "area_block.deleted",
        entityType: "area_block",
        entityId: blockId,
      })
      this.eventHub?.publish({
        type: "area_block.deleted",
      })
      res.json({ status: "unblocked" })
    } catch (err) {
      this.handleError(err, res)
    }
  }

  async blockSpace(req: Request, res: Response): Promise<void> {
    try {
      const spaceId = Number(req.body?.space_id)
      const blockDate = String(req.body?.block_date ?? "")
      const startTime = String(req.body?.start_time ?? "")
      const endTime = String(req.body?.end_time ?? "")
      const reason = typeof req.body?.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim()
        : null

      if (!Number.isInteger(spaceId) || spaceId <= 0) {
        res.status(400).json({ error: "INVALID_SPACE", message: "Espacio inválido" })
        return
      }

      if (!isIsoDate(blockDate) || !isTime(startTime) || !isTime(endTime) || endTime <= startTime) {
        res.status(400).json({ error: "INVALID_TIME_RANGE", message: "Fecha u horario inválido" })
        return
      }

      const block = await this.reservationRepository.blockSpace(spaceId, blockDate, startTime, endTime, reason)
      await this.reservationRepository.addAuditLog?.({
        actorUserId: (req as AuthRequest).userId,
        action: "space_block.created",
        entityType: "space_block",
        entityId: block.id,
        metadata: { space_id: block.space_id, block_date: block.block_date, start_time: block.start_time, end_time: block.end_time, reason },
      })
      this.eventHub?.publish({
        type: "space_block.created",
        floor_id: block.floor_id,
        space_id: block.space_id,
        reservation_date: block.block_date,
      })
      res.status(201).json(block)
    } catch (err) {
      this.handleError(err, res)
    }
  }

  async unblockSpace(req: Request, res: Response): Promise<void> {
    try {
      const blockId = Number(req.params.id)
      if (!Number.isInteger(blockId)) {
        res.status(400).json({ error: "INVALID_ID", message: "ID inválido" })
        return
      }

      const updated = await this.reservationRepository.unblockSpace(blockId)
      if (!updated) {
        res.status(404).json({ error: "NOT_FOUND", message: "Bloqueo no encontrado" })
        return
      }

      await this.reservationRepository.addAuditLog?.({
        actorUserId: (req as AuthRequest).userId,
        action: "space_block.deleted",
        entityType: "space_block",
        entityId: blockId,
      })
      this.eventHub?.publish({
        type: "space_block.deleted",
      })
      res.json({ status: "unblocked" })
    } catch (err) {
      this.handleError(err, res)
    }
  }

  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const query = typeof req.query.q === "string" ? req.query.q.trim() : ""
      if (query.length < 2) {
        res.json([])
        return
      }
      res.json(await this.reservationRepository.searchUsers(query))
    } catch (err) {
      this.handleError(err, res)
    }
  }

  async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const query = typeof req.query.q === "string" ? req.query.q : undefined
      const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined
      res.json(await this.reservationRepository.findAuditLogs({ query, limit }))
    } catch (err) {
      this.handleError(err, res)
    }
  }

  private handleError(err: unknown, res: Response): void {
    if (err instanceof ReservationError) {
      res.status(err.statusCode).json({ error: err.code, message: err.message })
      return
    }
    console.error("AdminController error:", err)
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
  }
}
