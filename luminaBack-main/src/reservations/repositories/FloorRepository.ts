import { Floor, Space } from "../interfaces"
import { ReservationError } from "../errors"
import { DbClient } from "../../shared/db"

export class FloorRepository {
  constructor(private readonly db: DbClient) {}

  async findAll(): Promise<Floor[]> {
    try {
      const result = await this.db.query<Floor>(
        `SELECT id, floor_number, building_id, name, plan_image_url, is_active
         FROM floors
         WHERE is_active = true
         ORDER BY floor_number`
      )
      return result.rows
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async findById(id: number): Promise<Floor | null> {
    try {
      const result = await this.db.query<Floor>(
        `SELECT id, floor_number, building_id, name, plan_image_url, is_active
         FROM floors WHERE id = $1 AND is_active = true`,
        [id]
      )
      return result.rows[0] ?? null
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }

  async findSpacesByFloorId(floorId: number): Promise<Space[]> {
    try {
      const result = await this.db.query<Space>(
        `SELECT id, space_number, display_name, floor_id, priority_category, is_active,
                layout_type, layout_direction, layout_cx, layout_cy, layout_points, visual_only
         FROM spaces
         WHERE floor_id = $1 AND is_active = true
         ORDER BY layout_cy, layout_cx`,
        [floorId]
      )
      return result.rows
    } catch (err) {
      if (err instanceof ReservationError) throw err
      throw new ReservationError(500, "DATABASE_ERROR", "Error de base de datos")
    }
  }
}
