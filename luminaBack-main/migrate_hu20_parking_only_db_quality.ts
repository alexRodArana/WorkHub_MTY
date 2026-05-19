import "dotenv/config"
import { Pool, PoolClient } from "pg"

const EMPTY_LEGACY_TABLES = [
  "friend_requests",
  "attendance_history",
  "occupancy_metrics",
  "occupancy_predictions",
  "parking_reservations",
  "reservation_parking_requests",
  "legacy_reservations",
  "social_notifications",
  "space_recommendations",
  "user_connections",
  "workspace_friends",
  "user_friends",
  "user_patterns",
  "user_privilege_levels",
]

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

async function dropIfEmpty(client: PoolClient, tableName: string): Promise<boolean> {
  const exists = await client.query<{ exists: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS exists`,
    [tableName]
  )
  if (!exists.rows[0]?.exists) return false

  const count = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(tableName)}`
  )
  if (Number(count.rows[0]?.count ?? 0) > 0) return false

  await client.query(`DROP TABLE ${quoteIdentifier(tableName)}`)
  return true
}

async function addConstraintIfMissing(client: PoolClient, name: string, sql: string): Promise<void> {
  const exists = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = $1
         AND connamespace = current_schema()::regnamespace
     ) AS exists`,
    [name]
  )

  if (!exists.rows[0]?.exists) {
    await client.query(sql)
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured")
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  const client = await pool.connect()
  const droppedTables: string[] = []

  try {
    await client.query("BEGIN")

    await client.query(`
      ALTER TABLE reservations
        ALTER COLUMN space_id DROP NOT NULL;

      UPDATE reservations
      SET requiere_estacionamiento = true,
          updated_at = NOW()
      WHERE parking_spot_id IS NOT NULL
        AND requiere_estacionamiento IS DISTINCT FROM true;

      UPDATE reservations
      SET requiere_estacionamiento = true,
          updated_at = NOW()
      WHERE space_id IS NULL
        AND requiere_estacionamiento IS DISTINCT FROM true;

      UPDATE spaces
      SET visual_only = false
      WHERE visual_only IS NULL;

      UPDATE floors f
      SET total_spaces = counts.total
      FROM (
        SELECT floor_id, COUNT(*)::int AS total
        FROM spaces
        WHERE is_active = true
          AND COALESCE(visual_only, false) = false
        GROUP BY floor_id
      ) counts
      WHERE counts.floor_id = f.id;
    `)

    await addConstraintIfMissing(
      client,
      "reservations_space_or_parking_chk",
      `ALTER TABLE reservations
       ADD CONSTRAINT reservations_space_or_parking_chk
       CHECK (space_id IS NOT NULL OR requiere_estacionamiento = true)`
    )

    await addConstraintIfMissing(
      client,
      "reservations_valid_time_chk",
      `ALTER TABLE reservations
       ADD CONSTRAINT reservations_valid_time_chk
       CHECK (end_time > start_time)`
    )

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reservations_user_date_status
        ON reservations (user_id, reservation_date, status);

      CREATE INDEX IF NOT EXISTS idx_reservations_workspace_overlap
        ON reservations (space_id, reservation_date, start_time, end_time)
        WHERE space_id IS NOT NULL
          AND status IN ('confirmada', 'activa');

      CREATE INDEX IF NOT EXISTS idx_reservations_parking_overlap
        ON reservations (parking_spot_id, reservation_date, start_time, end_time)
        WHERE parking_spot_id IS NOT NULL
          AND status IN ('confirmada', 'activa');

      CREATE INDEX IF NOT EXISTS idx_reservations_date_status_time
        ON reservations (reservation_date, status, start_time, end_time);

      CREATE INDEX IF NOT EXISTS idx_spaces_active_floor_category
        ON spaces (floor_id, priority_category)
        WHERE is_active = true
          AND COALESCE(visual_only, false) = false;

      CREATE INDEX IF NOT EXISTS idx_space_blocks_active_overlap
        ON space_blocks (space_id, block_date, start_time, end_time)
        WHERE is_active = true;

      CREATE INDEX IF NOT EXISTS idx_parking_spots_active_zone
        ON parking_spots (zone_id, spot_number)
        WHERE is_active = true;
    `)

    await client.query("DROP TABLE IF EXISTS friendships")

    for (const tableName of EMPTY_LEGACY_TABLES) {
      if (await dropIfEmpty(client, tableName)) {
        droppedTables.push(tableName)
      }
    }

    await client.query("COMMIT")

    await pool.query(`
      ANALYZE reservations;
      ANALYZE spaces;
      ANALYZE floors;
      ANALYZE parking_spots;
      ANALYZE space_blocks;
    `)

    const tables = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)
    const summary = []
    for (const row of tables.rows) {
      const count = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${quoteIdentifier(row.table_name)}`
      )
      summary.push({ table_name: row.table_name, rows: Number(count.rows[0]?.count ?? 0) })
    }

    console.log(JSON.stringify({
      migration: "hu20_parking_only_db_quality",
      dropped_empty_tables: droppedTables,
      tables: summary,
    }, null, 2))
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("HU20 parking-only/database quality migration failed:", error)
  process.exit(1)
})
