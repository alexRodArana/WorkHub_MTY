import { DbClient } from "../../shared/db"
import {
  AdminKpiOverview,
  AdminReservationDetail,
  AuditLogEntry,
  AreaBlock,
  AvailabilityFilter,
  ParkingReservationForGuard,
  PriorityCategory,
  PublicUserProfile,
  Reservation,
  ReservationEventDetails,
  NewReservationRecord,
  ReservationResult,
  ReservationStatus,
  SpaceBlock,
  SpaceOccupancy,
  UserPreferenceSignals,
  UserReservation,
  UserSearchResult,
  UserVehicle,
} from "../interfaces"
import { ReservationError } from "../errors"
import { getCheckInWindowOverrideMinutes } from "../config"

export class ReservationRepository {
  constructor(private readonly db: DbClient) {}

  async findVehiclesByUser(userId: number): Promise<UserVehicle[]> {
    const result = await this.db.query<UserVehicle>(
      `SELECT id, user_id, alias, plate, make, model, color, is_default, is_active, created_at, updated_at
       FROM user_vehicles
       WHERE user_id = $1
         AND is_active = true
       ORDER BY is_default DESC, created_at DESC, id DESC`,
      [userId]
    )
    return result.rows
  }

  async findVehicleByUser(userId: number, vehicleId: number): Promise<UserVehicle | null> {
    const result = await this.db.query<UserVehicle>(
      `SELECT id, user_id, alias, plate, make, model, color, is_default, is_active, created_at, updated_at
       FROM user_vehicles
       WHERE id = $1
         AND user_id = $2
         AND is_active = true
       LIMIT 1`,
      [vehicleId, userId]
    )
    return result.rows[0] ?? null
  }

  async createVehicle(
    userId: number,
    vehicle: { alias?: string | null; plate: string; make?: string | null; model?: string | null; color?: string | null; is_default?: boolean }
  ): Promise<UserVehicle> {
    const plate = vehicle.plate.trim().toUpperCase()
    if (vehicle.is_default) {
      await this.db.query("UPDATE user_vehicles SET is_default = false, updated_at = NOW() WHERE user_id = $1", [userId])
    }

    const result = await this.db.query<UserVehicle>(
      `INSERT INTO user_vehicles (user_id, alias, plate, make, model, color, is_default, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
       ON CONFLICT (user_id, plate)
       DO UPDATE SET alias = EXCLUDED.alias,
                     make = EXCLUDED.make,
                     model = EXCLUDED.model,
                     color = EXCLUDED.color,
                     is_default = EXCLUDED.is_default,
                     is_active = true,
                     updated_at = NOW()
       RETURNING id, user_id, alias, plate, make, model, color, is_default, is_active, created_at, updated_at`,
      [
        userId,
        vehicle.alias?.trim() || null,
        plate,
        vehicle.make?.trim() || null,
        vehicle.model?.trim() || null,
        vehicle.color?.trim() || null,
        vehicle.is_default === true,
      ]
    )
    return result.rows[0]
  }

  async updateVehicle(
    userId: number,
    vehicleId: number,
    vehicle: { alias?: string | null; plate: string; make?: string | null; model?: string | null; color?: string | null; is_default?: boolean }
  ): Promise<UserVehicle | null> {
    const plate = vehicle.plate.trim().toUpperCase()
    if (vehicle.is_default) {
      await this.db.query("UPDATE user_vehicles SET is_default = false, updated_at = NOW() WHERE user_id = $1", [userId])
    }

    const result = await this.db.query<UserVehicle>(
      `UPDATE user_vehicles
       SET alias = $3,
           plate = $4,
           make = $5,
           model = $6,
           color = $7,
           is_default = CASE WHEN $8::boolean THEN true ELSE is_default END,
           is_active = true,
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
         AND is_active = true
       RETURNING id, user_id, alias, plate, make, model, color, is_default, is_active, created_at, updated_at`,
      [
        vehicleId,
        userId,
        vehicle.alias?.trim() || null,
        plate,
        vehicle.make?.trim() || null,
        vehicle.model?.trim() || null,
        vehicle.color?.trim() || null,
        vehicle.is_default === true,
      ]
    )
    return result.rows[0] ?? null
  }

  async setDefaultVehicle(userId: number, vehicleId: number): Promise<UserVehicle | null> {
    const existing = await this.findVehicleByUser(userId, vehicleId)
    if (!existing) return null

    await this.db.query("UPDATE user_vehicles SET is_default = false, updated_at = NOW() WHERE user_id = $1", [userId])
    const result = await this.db.query<UserVehicle>(
      `UPDATE user_vehicles
       SET is_default = true,
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
       RETURNING id, user_id, alias, plate, make, model, color, is_default, is_active, created_at, updated_at`,
      [vehicleId, userId]
    )
    return result.rows[0] ?? null
  }

  async deactivateVehicle(userId: number, vehicleId: number): Promise<boolean> {
    const result = await this.db.query<{ id: number }>(
      `UPDATE user_vehicles
       SET is_active = false,
           is_default = false,
           updated_at = NOW()
       WHERE id = $1
         AND user_id = $2
         AND is_active = true
         AND NOT EXISTS (
           SELECT 1
           FROM reservations r
           WHERE r.vehicle_id = user_vehicles.id
             AND r.status IN ('confirmada', 'activa')
             AND r.reservation_date >= CURRENT_DATE
         )
       RETURNING id`,
      [vehicleId, userId]
    )
    return result.rows.length > 0
  }

  async addAuditLog(input: {
    actorUserId: number | null
    action: string
    entityType: string
    entityId?: string | number | null
    metadata?: Record<string, unknown>
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
      [
        input.actorUserId,
        input.action,
        input.entityType,
        input.entityId == null ? null : String(input.entityId),
        JSON.stringify(input.metadata ?? {}),
      ]
    )
  }

  async hasOverlappingOfficeForUser(
    userId: number,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    try {
      const result = await this.db.query<{ id: number }>(
        `SELECT id FROM reservations
         WHERE user_id = $1
           AND reservation_date = $2
           AND status IN ('confirmada', 'activa')
           AND space_id IS NOT NULL
           AND start_time < $4
           AND end_time > $3
         LIMIT 1`,
        [userId, date, startTime, endTime]
      )
      return result.rows.length > 0
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async hasOverlappingParkingForUser(
    userId: number,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    try {
      const result = await this.db.query<{ id: number }>(
        `SELECT id FROM reservations
         WHERE user_id = $1
           AND reservation_date = $2
           AND status IN ('confirmada', 'activa')
           AND parking_spot_id IS NOT NULL
           AND start_time < $4
           AND end_time > $3
         LIMIT 1`,
        [userId, date, startTime, endTime]
      )
      return result.rows.length > 0
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async hasOverlappingForSpace(
    spaceId: number,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    try {
      const result = await this.db.query<{ id: number }>(
        `SELECT id FROM reservations
         WHERE space_id = $1
           AND reservation_date = $2
           AND status IN ('confirmada', 'activa')
           AND start_time < $4
           AND end_time > $3
         LIMIT 1`,
        [spaceId, date, startTime, endTime]
      )
      return result.rows.length > 0
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async hasOverlappingBlockForSpace(
    spaceId: number,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    try {
      const result = await this.db.query<{ id: number }>(
        `SELECT id
         FROM space_blocks
         WHERE space_id = $1
           AND block_date = $2
           AND is_active = true
           AND start_time < $4
           AND end_time > $3
         LIMIT 1`,
        [spaceId, date, startTime, endTime]
      )
      return result.rows.length > 0
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async findByCode(code: string): Promise<Reservation | null> {
    try {
      const result = await this.db.query<Reservation>(
        "SELECT * FROM reservations WHERE reservation_code = $1",
        [code]
      )
      return result.rows[0] ?? null
    } catch (err) {
      if (err instanceof ReservationError) throw err
      // If reservation_code column doesn't exist, treat as not found (no collision)
      const pgErr = err as { code?: string }
      if (pgErr.code === "42703") return null
      console.error("findByCode raw error:", err)
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async findOccupancyByFloor(floorId: number, date: string): Promise<SpaceOccupancy[]> {
    try {
      const result = await this.db.query<{
        space_id: number
        start_time: string
        end_time: string
        status: "confirmada" | "activa"
        user: PublicUserProfile
      }>(
        `SELECT r.space_id,
                r.start_time::text AS start_time,
                r.end_time::text AS end_time,
                r.status,
                json_build_object(
                  'id', u.id,
                  'first_name', u.first_name,
                  'last_name', u.last_name,
                  'email', u.email,
                  'department', u.department,
                  'profile_photo_url', u.profile_photo_url
                ) AS user
         FROM reservations r
         JOIN spaces s ON s.id = r.space_id
         JOIN users u ON u.id = r.user_id
         WHERE s.floor_id = $1
           AND r.reservation_date = $2
           AND r.status IN ('confirmada', 'activa')
           AND r.space_id IS NOT NULL
         ORDER BY r.space_id, r.start_time`,
        [floorId, date]
      )

      const grouped = new Map<number, SpaceOccupancy["intervals"]>()
      for (const row of result.rows) {
        const intervals = grouped.get(row.space_id) ?? []
        intervals.push({
          start_time: row.start_time.slice(0, 5),
          end_time: row.end_time.slice(0, 5),
          status: row.status,
          user: row.user,
        })
        grouped.set(row.space_id, intervals)
      }

      return Array.from(grouped, ([space_id, intervals]) => ({ space_id, intervals }))
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async findById(id: number): Promise<Reservation | null> {
    try {
      const result = await this.db.query<Reservation>(
        "SELECT * FROM reservations WHERE id = $1",
        [id]
      )
      return result.rows[0] ?? null
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async findEventDetails(id: number): Promise<ReservationEventDetails | null> {
    try {
      const result = await this.db.query<ReservationEventDetails>(
        `SELECT r.id AS reservation_id,
                r.reservation_date::text AS reservation_date,
                r.space_id,
                s.floor_id,
                (r.parking_spot_id IS NOT NULL OR r.requiere_estacionamiento = true) AS parking
         FROM reservations r
         LEFT JOIN spaces s ON s.id = r.space_id
         WHERE r.id = $1`,
        [id]
      )
      return result.rows[0] ?? null
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async findPendingCheckInCandidates(beforeDate: string): Promise<Reservation[]> {
    try {
      const result = await this.db.query<Reservation>(
        `SELECT * FROM reservations
         WHERE status = 'confirmada'
           AND space_id IS NOT NULL
           AND reservation_date <= $1`,
        [beforeDate]
      )
      return result.rows
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async update(id: number, fields: { status?: ReservationStatus; check_in_time?: Date | null }): Promise<void> {
    try {
      const assignments: string[] = []
      const values: unknown[] = [id]

      if (fields.status !== undefined) {
        values.push(fields.status)
        assignments.push(`status = $${values.length}`)
      }

      if (fields.check_in_time !== undefined) {
        values.push(fields.check_in_time)
        assignments.push(`check_in_time = $${values.length}`)
      }

      if (assignments.length === 0) {
        return
      }

      assignments.push("updated_at = NOW()")
      await this.db.query(
        `UPDATE reservations SET ${assignments.join(", ")} WHERE id = $1`,
        values
      )
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async create(record: NewReservationRecord): Promise<ReservationResult> {
    try {
      const result = await this.db.query<{
        id: number
        space_id: number | null
        reservation_date: string
        start_time: string
        end_time: string
        status: string
        requiere_estacionamiento: boolean
        vehicle_id: number | null
      }>(
        `INSERT INTO reservations
           (user_id, space_id, reservation_date, start_time, end_time,
            status, grace_period_minutes, requiere_estacionamiento,
            check_in_time, check_out_time, reservation_code, vehicle_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
         RETURNING id, space_id, reservation_date, start_time, end_time, status, requiere_estacionamiento, vehicle_id`,
        [
          record.user_id,
          record.space_id,
          record.reservation_date,
          record.start_time,
          record.end_time,
          record.status,
          record.grace_period_minutes,
          record.requiere_estacionamiento,
          record.check_in_time,
          record.check_out_time,
          record.reservation_code,
          record.vehicle_id ?? null,
        ]
      )

      const row = result.rows[0]
      return {
        reservation_id: row.id,
        reservation_code: record.reservation_code,
        space_id: row.space_id,
        reservation_date: row.reservation_date,
        start_time: row.start_time,
        end_time: row.end_time,
        status: row.status as ReservationResult["status"],
        requiere_estacionamiento: row.requiere_estacionamiento,
        vehicle_id: row.vehicle_id,
        parking_spot: null,
      }
    } catch (err) {
      if (err instanceof ReservationError) throw err
      console.error("ReservationRepository.create error:", err)
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async findByUserId(userId: number, status?: string): Promise<UserReservation[]> {
    try {
      const params: unknown[] = [userId]
      let statusClause = ""
      if (status === "current") {
        statusClause = "AND r.status IN ('confirmada', 'activa') AND r.reservation_date >= CURRENT_DATE"
      } else if (status) {
        statusClause = `AND r.status = $2`
        params.push(status)
      }

      const result = await this.db.query<UserReservation>(
        `SELECT r.id AS reservation_id,
                r.reservation_code,
                COALESCE(s.space_number, 'Solo estacionamiento') AS space_number,
                COALESCE(f.name, 'Estacionamiento') AS floor_name,
                f.floor_number,
                r.reservation_date,
                r.start_time,
                r.end_time,
                r.status,
                r.grace_period_minutes,
                r.check_in_time,
                ps.spot_number  AS parking_spot_number,
                pz.name         AS parking_zone_name,
                uv.plate        AS vehicle_plate,
                COALESCE(uv.alias, NULLIF(TRIM(CONCAT_WS(' ', uv.make, uv.model)), ''), uv.plate) AS vehicle_label
         FROM reservations r
         LEFT JOIN spaces s ON s.id = r.space_id
         LEFT JOIN floors f ON f.id = s.floor_id
         LEFT JOIN parking_spots ps ON ps.id = r.parking_spot_id
         LEFT JOIN parking_zones pz ON pz.id = ps.zone_id
         LEFT JOIN user_vehicles uv ON uv.id = r.vehicle_id
         WHERE r.user_id = $1
           ${statusClause}
         ORDER BY r.reservation_date DESC, r.start_time DESC`,
        params
      )
      const overrideMinutes = getCheckInWindowOverrideMinutes()
      return result.rows.map((row) => ({
        ...row,
        grace_period_minutes:
          overrideMinutes !== null
            ? overrideMinutes
            : row.grace_period_minutes,
      }))
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async cancelById(reservationId: number, userId: number): Promise<boolean> {
    try {
      const today = new Date().toISOString().split("T")[0]
      // Return the updated row so we can check if anything was updated
      const result = await this.db.query<{ id: number }>(
        `UPDATE reservations
         SET status = 'cancelada'
         WHERE id = $1
           AND user_id = $2
           AND status = 'confirmada'
           AND reservation_date >= $3
         RETURNING id`,
        [reservationId, userId, today]
      )
      return result.rows.length > 0
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async findCurrentOccupants(filter: AvailabilityFilter): Promise<Array<{
    space_id: number
    floor_id: number
    layout_cx: number | null
    layout_cy: number | null
    user: PublicUserProfile
  }>> {
    const params: unknown[] = [filter.reservation_date, filter.start_time, filter.end_time]
    const conditions: string[] = []
    let idx = 4

    if (filter.floor_id !== undefined) {
      conditions.push(`s.floor_id = $${idx++}`)
      params.push(filter.floor_id)
    }

    const extra = conditions.length ? `AND ${conditions.join(" AND ")}` : ""
    const result = await this.db.query<{
      space_id: number
      floor_id: number
      layout_cx: number | null
      layout_cy: number | null
      user: PublicUserProfile
    }>(
      `SELECT s.id AS space_id,
              s.floor_id,
              s.layout_cx,
              s.layout_cy,
              json_build_object(
                'id', u.id,
                'first_name', u.first_name,
                'last_name', u.last_name,
                'email', u.email,
                'department', u.department,
                'profile_photo_url', u.profile_photo_url
              ) AS user
       FROM reservations r
       JOIN spaces s ON s.id = r.space_id
       JOIN users u ON u.id = r.user_id
       WHERE r.reservation_date = $1
         AND r.start_time < $3
         AND r.end_time > $2
         AND r.status IN ('confirmada', 'activa')
         ${extra}`,
      params
    )
    return result.rows
  }

  async findFrequentNeighbors(userId: number): Promise<Map<number, number>> {
    const result = await this.db.query<{ user_id: number; overlap_count: string }>(
      `SELECT other_r.user_id,
              COUNT(*)::text AS overlap_count
       FROM reservations my_r
       JOIN reservations other_r
         ON other_r.user_id <> my_r.user_id
        AND other_r.reservation_date = my_r.reservation_date
        AND other_r.start_time < my_r.end_time
        AND other_r.end_time > my_r.start_time
        AND other_r.space_id IS NOT NULL
        AND other_r.status IN ('confirmada', 'activa')
       WHERE my_r.user_id = $1
         AND my_r.space_id IS NOT NULL
         AND my_r.status IN ('confirmada', 'activa')
       GROUP BY other_r.user_id
       ORDER BY COUNT(*) DESC
       LIMIT 20`,
      [userId]
    )

    return new Map(result.rows.map((row) => [row.user_id, Number(row.overlap_count)]))
  }

  async findPredictedOccupancy(filter: AvailabilityFilter): Promise<number> {
    const params: unknown[] = [filter.reservation_date, filter.start_time, filter.end_time]
    const conditions: string[] = []
    let idx = 4

    if (filter.floor_id !== undefined) {
      conditions.push(`s.floor_id = $${idx++}`)
      params.push(filter.floor_id)
    }

    if (filter.priority_category !== undefined) {
      conditions.push(`s.priority_category = $${idx++}`)
      params.push(filter.priority_category)
    }

    const extra = conditions.length ? `AND ${conditions.join(" AND ")}` : ""
    const result = await this.db.query<{ rate: string }>(
      `WITH candidate_spaces AS (
         SELECT s.id
         FROM spaces s
         JOIN floors f ON f.id = s.floor_id
         WHERE s.is_active = true
           AND s.visual_only = false
           AND f.is_active = true
           ${extra}
       ),
       history AS (
         SELECT COUNT(DISTINCT r.space_id)::decimal AS occupied_spaces
         FROM reservations r
         JOIN spaces s ON s.id = r.space_id
         WHERE r.space_id IN (SELECT id FROM candidate_spaces)
           AND r.status IN ('confirmada', 'activa')
           AND EXTRACT(DOW FROM r.reservation_date::date) = EXTRACT(DOW FROM $1::date)
           AND r.start_time < $3
           AND r.end_time > $2
           AND r.reservation_date < $1::date
       )
       SELECT COALESCE(
         (SELECT occupied_spaces FROM history) / NULLIF((SELECT COUNT(*) FROM candidate_spaces), 0),
         0
       )::text AS rate`,
      params
    )

    const value = Number(result.rows[0]?.rate ?? 0)
    return Math.max(0, Math.min(1, value))
  }

  async findUserPreferenceSignals(userId: number): Promise<UserPreferenceSignals> {
    const result = await this.db.query<{
      space_id: number
      floor_id: number
      priority_category: PriorityCategory
      reservation_count: string
    }>(
      `SELECT s.id AS space_id,
              s.floor_id,
              s.priority_category,
              COUNT(*)::text AS reservation_count
       FROM reservations r
       JOIN spaces s ON s.id = r.space_id
       WHERE r.user_id = $1
         AND r.space_id IS NOT NULL
         AND r.status IN ('confirmada', 'activa')
         AND r.reservation_date >= CURRENT_DATE - INTERVAL '180 days'
       GROUP BY s.id, s.floor_id, s.priority_category`,
      [userId]
    )

    const spaces = new Map<number, number>()
    const floors = new Map<number, number>()
    const categories = new Map<PriorityCategory, number>()
    let totalReservations = 0

    for (const row of result.rows) {
      const count = Number(row.reservation_count)
      totalReservations += count
      spaces.set(row.space_id, (spaces.get(row.space_id) ?? 0) + count)
      floors.set(row.floor_id, (floors.get(row.floor_id) ?? 0) + count)
      categories.set(row.priority_category, (categories.get(row.priority_category) ?? 0) + count)
    }

    return {
      total_reservations: totalReservations,
      spaces,
      floors,
      categories,
    }
  }

  async findSpaceDemandScores(filter: AvailabilityFilter): Promise<Map<number, number>> {
    const params: unknown[] = [filter.reservation_date, filter.start_time, filter.end_time]
    const conditions: string[] = []
    let idx = 4

    if (filter.floor_id !== undefined) {
      conditions.push(`s.floor_id = $${idx++}`)
      params.push(filter.floor_id)
    }

    if (filter.priority_category !== undefined) {
      conditions.push(`s.priority_category = $${idx++}`)
      params.push(filter.priority_category)
    }

    const extra = conditions.length ? `AND ${conditions.join(" AND ")}` : ""
    const result = await this.db.query<{ space_id: number; demand_score: string }>(
      `WITH candidate_spaces AS (
         SELECT s.id
         FROM spaces s
         JOIN floors f ON f.id = s.floor_id
         WHERE s.is_active = true
           AND s.visual_only = false
           AND f.is_active = true
           ${extra}
       ),
       demand AS (
         SELECT r.space_id,
                COUNT(*)::decimal AS reservation_count
         FROM reservations r
         WHERE r.space_id IN (SELECT id FROM candidate_spaces)
           AND r.status IN ('confirmada', 'activa')
           AND EXTRACT(DOW FROM r.reservation_date::date) = EXTRACT(DOW FROM $1::date)
           AND r.start_time < $3
           AND r.end_time > $2
           AND r.reservation_date >= $1::date - INTERVAL '120 days'
           AND r.reservation_date < $1::date
         GROUP BY r.space_id
       )
       SELECT d.space_id,
              (d.reservation_count / NULLIF(MAX(d.reservation_count) OVER (), 0))::text AS demand_score
       FROM demand d`,
      params
    )

    return new Map(result.rows.map((row) => [
      row.space_id,
      Math.max(0, Math.min(1, Number(row.demand_score ?? 0))),
    ]))
  }

  async getAdminOverview(date: string): Promise<AdminKpiOverview> {
    const [totals, byFloor, byCategory, areaBlocks, spaceBlocks, statusBreakdown, hourlyDistribution, topUsers, topSpaces, underusedSpaces, adminDetails] = await Promise.all([
      this.db.query<{
        total_reservations: string
        active_reservations: string
        confirmed_reservations: string
        cancelled_reservations: string
        no_show_reservations: string
        parking_reservations: string
        workspace_reservations: string
        desk_only_reservations: string
        desk_parking_reservations: string
        parking_only_reservations: string
        average_duration_minutes: string | null
        unique_users: string
        total_spaces: string
        occupied_spaces: string
      }>(
        `WITH daily_reservations AS (
           SELECT user_id, space_id, parking_spot_id, requiere_estacionamiento, status, start_time, end_time
           FROM reservations
           WHERE reservation_date = $1
         )
         SELECT
           COUNT(*) FILTER (WHERE status IN ('confirmada', 'activa', 'no_show'))::text AS total_reservations,
           COUNT(*) FILTER (WHERE status = 'activa')::text AS active_reservations,
           COUNT(*) FILTER (WHERE status = 'confirmada')::text AS confirmed_reservations,
           COUNT(*) FILTER (WHERE status = 'cancelada')::text AS cancelled_reservations,
           COUNT(*) FILTER (WHERE status = 'no_show')::text AS no_show_reservations,
           COUNT(*) FILTER (WHERE status IN ('confirmada', 'activa') AND parking_spot_id IS NOT NULL)::text AS parking_reservations,
           COUNT(*) FILTER (WHERE status IN ('confirmada', 'activa') AND space_id IS NOT NULL)::text AS workspace_reservations,
           COUNT(*) FILTER (WHERE status IN ('confirmada', 'activa') AND space_id IS NOT NULL AND parking_spot_id IS NULL)::text AS desk_only_reservations,
           COUNT(*) FILTER (WHERE status IN ('confirmada', 'activa') AND space_id IS NOT NULL AND parking_spot_id IS NOT NULL)::text AS desk_parking_reservations,
           COUNT(*) FILTER (WHERE status IN ('confirmada', 'activa') AND space_id IS NULL AND (parking_spot_id IS NOT NULL OR requiere_estacionamiento = true))::text AS parking_only_reservations,
           ROUND(AVG(EXTRACT(EPOCH FROM (end_time - start_time)) / 60) FILTER (WHERE status IN ('confirmada', 'activa')))::text AS average_duration_minutes,
           COUNT(DISTINCT user_id) FILTER (WHERE status IN ('confirmada', 'activa'))::text AS unique_users,
           (SELECT COUNT(*) FROM spaces WHERE is_active = true AND visual_only = false)::text AS total_spaces,
           COUNT(DISTINCT space_id) FILTER (WHERE status IN ('confirmada', 'activa') AND space_id IS NOT NULL)::text AS occupied_spaces
         FROM daily_reservations`,
        [date]
      ),
      this.db.query<{
        floor_id: number
        floor_name: string
        total_spaces: string
        occupied_spaces: string
      }>(
        `SELECT f.id AS floor_id,
                f.name AS floor_name,
                COUNT(DISTINCT s.id)::text AS total_spaces,
                COUNT(DISTINCT r.space_id)::text AS occupied_spaces
         FROM floors f
         LEFT JOIN spaces s ON s.floor_id = f.id AND s.is_active = true AND s.visual_only = false
         LEFT JOIN reservations r ON r.space_id = s.id
          AND r.reservation_date = $1
          AND r.status IN ('confirmada', 'activa')
         WHERE f.is_active = true
         GROUP BY f.id, f.name
         ORDER BY f.floor_number`,
        [date]
      ),
      this.db.query<{
        priority_category: PriorityCategory
        total_spaces: string
        occupied_spaces: string
      }>(
        `SELECT s.priority_category,
                COUNT(DISTINCT s.id)::text AS total_spaces,
                COUNT(DISTINCT r.space_id)::text AS occupied_spaces
         FROM spaces s
         LEFT JOIN reservations r ON r.space_id = s.id
          AND r.reservation_date = $1
          AND r.status IN ('confirmada', 'activa')
         WHERE s.is_active = true
           AND s.visual_only = false
           AND s.priority_category IS NOT NULL
         GROUP BY s.priority_category
         ORDER BY s.priority_category`,
        [date]
      ),
      this.findAreaBlocks(),
      this.findSpaceBlocks(date),
      this.db.query<{ status: ReservationStatus; count: string }>(
        `SELECT status, COUNT(*)::text AS count
         FROM reservations
         WHERE reservation_date = $1
         GROUP BY status
         ORDER BY status`,
        [date]
      ),
      this.db.query<{ hour: string; reservations: string }>(
        `SELECT to_char(date_trunc('hour', start_time::time), 'HH24:MI') AS hour,
                COUNT(*)::text AS reservations
         FROM reservations
         WHERE reservation_date = $1
           AND status IN ('confirmada', 'activa')
         GROUP BY date_trunc('hour', start_time::time)
         ORDER BY date_trunc('hour', start_time::time)`,
        [date]
      ),
      this.db.query<{
        user_id: number
        first_name: string
        last_name: string
        email: string
        reservations: string
      }>(
        `SELECT u.id AS user_id,
                u.first_name,
                u.last_name,
                u.email,
                COUNT(*)::text AS reservations
         FROM reservations r
         JOIN users u ON u.id = r.user_id
         WHERE r.reservation_date = $1
           AND r.status IN ('confirmada', 'activa')
         GROUP BY u.id, u.first_name, u.last_name, u.email
         ORDER BY COUNT(*) DESC, u.first_name
         LIMIT 5`,
        [date]
      ),
      this.db.query<{
        space_id: number
        space_number: string
        display_name: string | null
        floor_name: string
        reservations: string
      }>(
        `SELECT s.id AS space_id,
                s.space_number,
                s.display_name,
                f.name AS floor_name,
                COUNT(r.id)::text AS reservations
         FROM reservations r
         JOIN spaces s ON s.id = r.space_id
         JOIN floors f ON f.id = s.floor_id
         WHERE r.reservation_date BETWEEN ($1::date - INTERVAL '30 days') AND $1::date
           AND r.status IN ('confirmada', 'activa', 'no_show')
           AND r.space_id IS NOT NULL
         GROUP BY s.id, s.space_number, s.display_name, f.name
         ORDER BY COUNT(r.id) DESC, s.space_number
         LIMIT 8`,
        [date]
      ),
      this.db.query<{
        space_id: number
        space_number: string
        display_name: string | null
        floor_name: string
        reservations: string
        last_reservation_date: string | null
      }>(
        `SELECT s.id AS space_id,
                s.space_number,
                s.display_name,
                f.name AS floor_name,
                COUNT(r.id)::text AS reservations,
                MAX(r.reservation_date)::text AS last_reservation_date
         FROM spaces s
         JOIN floors f ON f.id = s.floor_id
         LEFT JOIN reservations r ON r.space_id = s.id
          AND r.reservation_date BETWEEN ($1::date - INTERVAL '30 days') AND $1::date
          AND r.status IN ('confirmada', 'activa', 'no_show')
         WHERE s.is_active = true
           AND COALESCE(s.visual_only, false) = false
         GROUP BY s.id, s.space_number, s.display_name, f.name
         ORDER BY COUNT(r.id) ASC, MAX(r.reservation_date) NULLS FIRST, s.space_number
         LIMIT 8`,
        [date]
      ),
      this.db.query<AdminReservationDetail>(
        `SELECT r.id AS reservation_id,
                r.reservation_code,
                r.reservation_date::text AS reservation_date,
                r.start_time::text AS start_time,
                r.end_time::text AS end_time,
                r.status,
                CASE
                  WHEN r.space_id IS NULL THEN 'parking_only'
                  WHEN r.parking_spot_id IS NOT NULL OR r.requiere_estacionamiento = true THEN 'desk_parking'
                  ELSE 'desk_only'
                END AS type,
                u.id AS user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.department,
                r.space_id,
                COALESCE(s.space_number, 'Solo estacionamiento') AS space_number,
                s.display_name,
                f.id AS floor_id,
                COALESCE(f.name, 'Estacionamiento') AS floor_name,
                f.floor_number,
                ps.spot_number AS parking_spot_number,
                pz.name AS parking_zone_name,
                r.vehicle_id,
                uv.plate AS vehicle_plate,
                COALESCE(uv.alias, NULLIF(TRIM(CONCAT_WS(' ', uv.make, uv.model)), ''), uv.plate) AS vehicle_label
         FROM reservations r
         JOIN users u ON u.id = r.user_id
         LEFT JOIN spaces s ON s.id = r.space_id
         LEFT JOIN floors f ON f.id = s.floor_id
         LEFT JOIN parking_spots ps ON ps.id = r.parking_spot_id
         LEFT JOIN parking_zones pz ON pz.id = ps.zone_id
         LEFT JOIN user_vehicles uv ON uv.id = r.vehicle_id
         WHERE r.reservation_date = $1
         ORDER BY r.start_time, u.first_name, u.last_name
         LIMIT 500`,
        [date]
      ),
    ])

    const total = totals.rows[0] ?? {
      total_reservations: "0",
      active_reservations: "0",
      confirmed_reservations: "0",
      cancelled_reservations: "0",
      no_show_reservations: "0",
      parking_reservations: "0",
      workspace_reservations: "0",
      desk_only_reservations: "0",
      desk_parking_reservations: "0",
      parking_only_reservations: "0",
      average_duration_minutes: "0",
      unique_users: "0",
      total_spaces: "0",
      occupied_spaces: "0",
    }
    const totalSpaces = Number(total.total_spaces)
    const occupiedSpaces = Number(total.occupied_spaces)

    return {
      date,
      total_reservations: Number(total.total_reservations),
      active_reservations: Number(total.active_reservations),
      confirmed_reservations: Number(total.confirmed_reservations),
      cancelled_reservations: Number(total.cancelled_reservations),
      no_show_reservations: Number(total.no_show_reservations),
      parking_reservations: Number(total.parking_reservations),
      parking_rate: Number(total.total_reservations) > 0
        ? Number(total.parking_reservations) / Number(total.total_reservations)
        : 0,
      workspace_reservations: Number(total.workspace_reservations),
      desk_only_reservations: Number(total.desk_only_reservations),
      desk_parking_reservations: Number(total.desk_parking_reservations),
      parking_only_reservations: Number(total.parking_only_reservations),
      available_spaces: Math.max(0, totalSpaces - occupiedSpaces),
      average_duration_minutes: Number(total.average_duration_minutes ?? 0),
      check_in_rate: Number(total.workspace_reservations) > 0
        ? Number(total.active_reservations) / Number(total.workspace_reservations)
        : 0,
      cancellation_rate: Number(total.total_reservations) + Number(total.cancelled_reservations) > 0
        ? Number(total.cancelled_reservations) / (Number(total.total_reservations) + Number(total.cancelled_reservations))
        : 0,
      no_show_rate: Number(total.total_reservations) > 0
        ? Number(total.no_show_reservations) / Number(total.total_reservations)
        : 0,
      unique_users: Number(total.unique_users),
      total_spaces: totalSpaces,
      occupied_spaces: occupiedSpaces,
      occupancy_rate: totalSpaces > 0 ? occupiedSpaces / totalSpaces : 0,
      blocked_area_count: areaBlocks.length,
      blocked_space_count: spaceBlocks.length,
      status_breakdown: statusBreakdown.rows.map((row) => ({
        status: row.status,
        count: Number(row.count),
      })),
      reservation_type_breakdown: [
        { type: "desk_only", count: Number(total.desk_only_reservations) },
        { type: "desk_parking", count: Number(total.desk_parking_reservations) },
        { type: "parking_only", count: Number(total.parking_only_reservations) },
      ],
      hourly_distribution: hourlyDistribution.rows.map((row) => ({
        hour: row.hour,
        reservations: Number(row.reservations),
      })),
      top_users: topUsers.rows.map((row) => ({
        user_id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        reservations: Number(row.reservations),
      })),
      top_spaces: topSpaces.rows.map((row) => ({
        space_id: row.space_id,
        space_number: row.space_number,
        display_name: row.display_name,
        floor_name: row.floor_name,
        reservations: Number(row.reservations),
      })),
      underused_spaces: underusedSpaces.rows.map((row) => ({
        space_id: row.space_id,
        space_number: row.space_number,
        display_name: row.display_name,
        floor_name: row.floor_name,
        reservations: Number(row.reservations),
        last_reservation_date: row.last_reservation_date,
      })),
      by_floor: byFloor.rows.map((row) => {
        const floorTotal = Number(row.total_spaces)
        const floorOccupied = Number(row.occupied_spaces)
        return {
          floor_id: row.floor_id,
          floor_name: row.floor_name,
          total_spaces: floorTotal,
          occupied_spaces: floorOccupied,
          occupancy_rate: floorTotal > 0 ? floorOccupied / floorTotal : 0,
        }
      }),
      by_category: byCategory.rows.map((row) => {
        const categoryTotal = Number(row.total_spaces)
        const categoryOccupied = Number(row.occupied_spaces)
        return {
          priority_category: row.priority_category,
          total_spaces: categoryTotal,
          occupied_spaces: categoryOccupied,
          occupancy_rate: categoryTotal > 0 ? categoryOccupied / categoryTotal : 0,
        }
      }),
      blocked_areas: areaBlocks,
      blocked_spaces: spaceBlocks,
      reservations_detail: adminDetails.rows.map((row) => ({
        ...row,
        start_time: row.start_time.slice(0, 5),
        end_time: row.end_time.slice(0, 5),
      })),
    }
  }

  async findAreaBlocks(): Promise<AreaBlock[]> {
    const result = await this.db.query<AreaBlock>(
      `SELECT ab.id,
              ab.floor_id,
              f.name AS floor_name,
              ab.priority_category,
              ab.reason,
              ab.is_active,
              ab.created_at
       FROM area_blocks ab
       JOIN floors f ON f.id = ab.floor_id
       WHERE ab.is_active = true
       ORDER BY f.floor_number, ab.priority_category`
    )
    return result.rows
  }

  async searchUsers(query: string): Promise<UserSearchResult[]> {
    const normalized = `%${query.trim().toLowerCase()}%`
    const result = await this.db.query<UserSearchResult>(
      `SELECT u.id,
              u.first_name,
              u.last_name,
              u.email,
              u.role,
              u.department,
              u.profile_photo_url,
              COUNT(DISTINCT r.id)::int AS reservation_count,
              COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('confirmada', 'activa'))::int AS active_reservation_count,
              COUNT(DISTINCT r.id) FILTER (WHERE r.parking_spot_id IS NOT NULL OR r.requiere_estacionamiento = true)::int AS parking_reservation_count,
              COUNT(DISTINCT uv.id)::int AS vehicle_count,
              MAX(r.reservation_date)::text AS last_reservation_date
       FROM users u
       LEFT JOIN reservations r ON r.user_id = u.id
       LEFT JOIN user_vehicles uv ON uv.user_id = u.id AND uv.is_active = true
       WHERE u.is_active = true
         AND (
           LOWER(u.first_name) LIKE $1
           OR LOWER(u.last_name) LIKE $1
           OR LOWER(u.email) LIKE $1
           OR LOWER(COALESCE(u.department, '')) LIKE $1
           OR LOWER(COALESCE(u.employee_id, '')) LIKE $1
           OR LOWER(COALESCE(uv.plate, '')) LIKE $1
           OR LOWER(COALESCE(uv.alias, '')) LIKE $1
         )
       GROUP BY u.id, u.first_name, u.last_name, u.email, u.role, u.department, u.profile_photo_url
       ORDER BY u.first_name, u.last_name
       LIMIT 25`,
      [normalized]
    )
    return result.rows
  }

  async blockArea(floorId: number, priorityCategory: PriorityCategory, reason: string | null): Promise<AreaBlock> {
    const result = await this.db.query<AreaBlock>(
      `INSERT INTO area_blocks (floor_id, priority_category, reason, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, true, NOW(), NOW())
       ON CONFLICT (floor_id, priority_category)
       DO UPDATE SET reason = EXCLUDED.reason, is_active = true, updated_at = NOW()
       RETURNING id,
                 floor_id,
                 (SELECT name FROM floors WHERE id = $1) AS floor_name,
                 priority_category,
                 reason,
                 is_active,
                 created_at`,
      [floorId, priorityCategory, reason]
    )
    return result.rows[0]
  }

  async unblockArea(blockId: number): Promise<boolean> {
    const result = await this.db.query<{ id: number }>(
      `UPDATE area_blocks
       SET is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [blockId]
    )
    return result.rows.length > 0
  }

  async findSpaceBlocks(date?: string): Promise<SpaceBlock[]> {
    const result = await this.db.query<SpaceBlock>(
      `SELECT sb.id,
              sb.space_id,
              s.space_number,
              s.floor_id,
              f.name AS floor_name,
              sb.block_date::text AS block_date,
              sb.start_time::text AS start_time,
              sb.end_time::text AS end_time,
              sb.reason,
              sb.is_active,
              sb.created_at
       FROM space_blocks sb
       JOIN spaces s ON s.id = sb.space_id
       JOIN floors f ON f.id = s.floor_id
       WHERE sb.is_active = true
         AND ($1::date IS NULL OR sb.block_date = $1::date)
       ORDER BY sb.block_date, sb.start_time, f.floor_number, s.space_number`,
      [date ?? null]
    )

    return result.rows.map((row) => ({
      ...row,
      start_time: row.start_time.slice(0, 5),
      end_time: row.end_time.slice(0, 5),
    }))
  }

  async blockSpace(
    spaceId: number,
    blockDate: string,
    startTime: string,
    endTime: string,
    reason: string | null
  ): Promise<SpaceBlock> {
    const spaceExists = await this.db.query<{ id: number }>(
      "SELECT id FROM spaces WHERE id = $1 AND is_active = true AND COALESCE(visual_only, false) = false LIMIT 1",
      [spaceId]
    )
    if (spaceExists.rows.length === 0) {
      throw new ReservationError(404, "SPACE_NOT_FOUND", "El espacio no existe o no está disponible")
    }

    const reservationConflict = await this.db.query<{ id: number }>(
      `SELECT id
       FROM reservations
       WHERE space_id = $1
         AND reservation_date = $2
         AND status IN ('confirmada', 'activa')
         AND start_time < $4
         AND end_time > $3
       LIMIT 1`,
      [spaceId, blockDate, startTime, endTime]
    )

    if (reservationConflict.rows.length > 0) {
      throw new ReservationError(409, "SPACE_UNAVAILABLE", "El espacio ya tiene una reserva en ese horario")
    }

    const existingBlock = await this.db.query<{ id: number }>(
      `SELECT id
       FROM space_blocks
       WHERE space_id = $1
         AND block_date = $2
         AND is_active = true
         AND start_time < $4
         AND end_time > $3
       LIMIT 1`,
      [spaceId, blockDate, startTime, endTime]
    )

    if (existingBlock.rows.length > 0) {
      throw new ReservationError(409, "SPACE_UNAVAILABLE", "El espacio ya está bloqueado en ese horario")
    }

    const result = await this.db.query<SpaceBlock>(
      `WITH inserted AS (
         INSERT INTO space_blocks (space_id, block_date, start_time, end_time, reason, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
         RETURNING *
       )
       SELECT inserted.id,
              inserted.space_id,
              s.space_number,
              s.floor_id,
              f.name AS floor_name,
              inserted.block_date::text AS block_date,
              inserted.start_time::text AS start_time,
              inserted.end_time::text AS end_time,
              inserted.reason,
              inserted.is_active,
              inserted.created_at
       FROM inserted
       JOIN spaces s ON s.id = inserted.space_id
       JOIN floors f ON f.id = s.floor_id`,
      [spaceId, blockDate, startTime, endTime, reason]
    )

    const row = result.rows[0]
    return {
      ...row,
      start_time: row.start_time.slice(0, 5),
      end_time: row.end_time.slice(0, 5),
    }
  }

  async unblockSpace(blockId: number): Promise<boolean> {
    const result = await this.db.query<{ id: number }>(
      `UPDATE space_blocks
       SET is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [blockId]
    )
    return result.rows.length > 0
  }

  async findParkingReservationsByDate(date: string, query?: string): Promise<ParkingReservationForGuard[]> {
    const normalized = query?.trim().toLowerCase()
    const result = await this.db.query<ParkingReservationForGuard>(
      `SELECT r.id AS reservation_id,
              r.reservation_code,
              r.reservation_date::text AS reservation_date,
              r.start_time::text AS start_time,
              r.end_time::text AS end_time,
              r.status,
              ps.spot_number AS parking_spot_number,
              pz.name AS parking_zone_name,
              uv.plate AS vehicle_plate,
              COALESCE(uv.alias, NULLIF(TRIM(CONCAT_WS(' ', uv.make, uv.model)), ''), uv.plate) AS vehicle_label,
              COALESCE(s.space_number, 'Solo estacionamiento') AS space_number,
              COALESCE(f.name, 'Estacionamiento') AS floor_name,
              json_build_object(
                'id', u.id,
                'first_name', u.first_name,
                'last_name', u.last_name,
                'email', u.email,
                'department', u.department,
                'profile_photo_url', u.profile_photo_url
              ) AS user
       FROM reservations r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN spaces s ON s.id = r.space_id
       LEFT JOIN floors f ON f.id = s.floor_id
       JOIN parking_spots ps ON ps.id = r.parking_spot_id
       JOIN parking_zones pz ON pz.id = ps.zone_id
       LEFT JOIN user_vehicles uv ON uv.id = r.vehicle_id
       WHERE r.reservation_date = $1
         AND r.status IN ('confirmada', 'activa')
         AND r.parking_spot_id IS NOT NULL
         AND (
           $2::text IS NULL
           OR LOWER(u.first_name) LIKE $2
           OR LOWER(u.last_name) LIKE $2
           OR LOWER(u.email) LIKE $2
           OR LOWER(COALESCE(u.department, '')) LIKE $2
           OR LOWER(COALESCE(uv.plate, '')) LIKE $2
           OR LOWER(COALESCE(uv.alias, '')) LIKE $2
           OR LOWER(COALESCE(ps.spot_number, '')) LIKE $2
           OR LOWER(COALESCE(pz.name, '')) LIKE $2
         )
       ORDER BY pz.priority_order, ps.spot_number, r.start_time`,
      [date, normalized ? `%${normalized}%` : null]
    )
    return result.rows.map((row) => ({
      ...row,
      start_time: row.start_time.slice(0, 5),
      end_time: row.end_time.slice(0, 5),
    }))
  }

  async findAuditLogs(options: { query?: string; limit?: number }): Promise<AuditLogEntry[]> {
    const query = options.query?.trim().toLowerCase()
    const limit = Math.max(1, Math.min(100, options.limit ?? 50))
    const result = await this.db.query<AuditLogEntry>(
      `SELECT al.id::int AS id,
              al.actor_user_id,
              u.first_name AS actor_first_name,
              u.last_name AS actor_last_name,
              u.email AS actor_email,
              al.action,
              al.entity_type,
              al.entity_id,
              al.metadata,
              al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       WHERE (
         $1::text IS NULL
         OR LOWER(al.action) LIKE $1
         OR LOWER(al.entity_type) LIKE $1
         OR LOWER(COALESCE(al.entity_id, '')) LIKE $1
         OR LOWER(COALESCE(u.email, '')) LIKE $1
         OR LOWER(COALESCE(u.first_name, '')) LIKE $1
         OR LOWER(COALESCE(u.last_name, '')) LIKE $1
       )
       ORDER BY al.created_at DESC
       LIMIT $2`,
      [query ? `%${query}%` : null, limit]
    )
    return result.rows
  }
}
