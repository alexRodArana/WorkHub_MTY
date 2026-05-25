import { Space, AvailabilityFilter } from "../interfaces"
import { ReservationError } from "../errors"
import { DbClient } from "../../shared/db"

export type { DbClient }

export class SpaceRepository {
  constructor(private readonly db: DbClient) {}

  async findAvailable(filter: AvailabilityFilter): Promise<Space[]> {
    try {
      const params: unknown[] = [
        filter.reservation_date,
        filter.end_time,
        filter.start_time,
      ]

      let paramIndex = 4
      const extraConditions: string[] = []

      if (filter.floor_id !== undefined) {
        extraConditions.push(`spaces.floor_id = $${paramIndex}`)
        params.push(filter.floor_id)
        paramIndex++
      }

      if (filter.priority_category !== undefined) {
        extraConditions.push(`spaces.priority_category = $${paramIndex}`)
        params.push(filter.priority_category)
        paramIndex++
      }

      const whereClause =
        extraConditions.length > 0
          ? `AND ${extraConditions.join(" AND ")}`
          : ""

      const sql = `
        SELECT spaces.id, spaces.space_number, spaces.display_name, spaces.floor_id, spaces.priority_category, spaces.is_active,
               spaces.layout_type, spaces.layout_direction, spaces.layout_cx, spaces.layout_cy,
               spaces.layout_points, spaces.visual_only
        FROM spaces
        JOIN floors ON spaces.floor_id = floors.id
        WHERE spaces.is_active = true
          AND spaces.visual_only = false
          AND floors.is_active = true
          AND NOT EXISTS (
            SELECT 1
            FROM area_blocks ab
            WHERE ab.floor_id = spaces.floor_id
              AND ab.priority_category = spaces.priority_category
              AND ab.is_active = true
          )
          AND NOT EXISTS (
            SELECT 1
            FROM space_blocks sb
            WHERE sb.space_id = spaces.id
              AND sb.block_date = $1
              AND sb.start_time < $2
              AND sb.end_time > $3
              AND sb.is_active = true
          )
          ${whereClause}
          AND NOT EXISTS (
            SELECT 1 FROM reservations existing
            WHERE existing.space_id = spaces.id
              AND existing.reservation_date = $1
              AND existing.start_time < $2
              AND existing.end_time > $3
              AND existing.status IN ('confirmada', 'activa')
          )
      `

      const result = await this.db.query<Space>(sql, params)
      return result.rows
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async findById(id: number): Promise<Space | null> {
    try {
      const result = await this.db.query<Space>(
        `SELECT id, space_number, display_name, floor_id, priority_category, is_active,
                layout_type, layout_direction, layout_cx, layout_cy, layout_points, visual_only
         FROM spaces
         WHERE id = $1
           AND is_active = true
           AND visual_only = false
           AND NOT EXISTS (
             SELECT 1
             FROM area_blocks ab
             WHERE ab.floor_id = spaces.floor_id
               AND ab.priority_category = spaces.priority_category
               AND ab.is_active = true
           )`,
        [id]
      )
      return result.rows[0] ?? null
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }
}
