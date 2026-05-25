import "dotenv/config"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function main(): Promise<void> {
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reservations_admin_daily
      ON reservations (reservation_date, status, user_id, space_id, parking_spot_id, start_time, end_time);

    CREATE INDEX IF NOT EXISTS idx_reservations_floor_daily
      ON reservations (reservation_date, status, space_id)
      WHERE space_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_space_blocks_active_date_space
      ON space_blocks (block_date, space_id, start_time, end_time)
      WHERE is_active = true;

    CREATE INDEX IF NOT EXISTS idx_spaces_admin_active
      ON spaces (is_active, visual_only, floor_id, priority_category);

    ANALYZE reservations;
    ANALYZE spaces;
    ANALYZE space_blocks;
  `)
}

main()
  .then(async () => {
    console.log("HU21 admin performance indexes applied")
    await pool.end()
  })
  .catch(async (error) => {
    console.error("HU21 admin performance index migration failed:", error)
    await pool.end()
    process.exit(1)
  })
