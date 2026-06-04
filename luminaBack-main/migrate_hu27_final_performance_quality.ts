import "dotenv/config"
import { Pool, PoolClient } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function step(label: string, fn: (client: PoolClient) => Promise<void>): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query("SET statement_timeout = 0")
    await fn(client)
    console.log(`  ✓ ${label}`)
  } catch (error) {
    const pgError = error as { message?: string }
    console.error(`  ✗ ${label}: ${pgError.message ?? String(error)}`)
    throw error
  } finally {
    client.release()
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured")
  }

  console.log("\nRunning HU27 final performance and quality migration...")

  await step("extensions", async (client) => {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS btree_gist;
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `)
  })

  await step("reservation query indexes", async (client) => {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reservations_checkout_open
        ON reservations (id, user_id)
        WHERE status IN ('confirmada', 'activa') AND check_out_time IS NULL;

      CREATE INDEX IF NOT EXISTS idx_reservations_admin_period_cover
        ON reservations (reservation_date, status, start_time)
        INCLUDE (end_time, user_id, space_id, parking_spot_id, vehicle_id, requiere_estacionamiento);

      CREATE INDEX IF NOT EXISTS idx_reservations_user_open_period
        ON reservations (user_id, reservation_date, start_time, end_time)
        WHERE status IN ('confirmada', 'activa');

      CREATE INDEX IF NOT EXISTS idx_reservations_space_open_period
        ON reservations (space_id, reservation_date, start_time, end_time)
        WHERE space_id IS NOT NULL AND status IN ('confirmada', 'activa');

      CREATE INDEX IF NOT EXISTS idx_reservations_parking_open_period
        ON reservations (parking_spot_id, reservation_date, start_time, end_time)
        WHERE parking_spot_id IS NOT NULL AND status IN ('confirmada', 'activa');

      CREATE INDEX IF NOT EXISTS idx_reservations_history_user_recent
        ON reservations (user_id, reservation_date DESC, start_time DESC)
        INCLUDE (status, space_id, parking_spot_id, vehicle_id, reservation_code);
    `)
  })

  await step("map, parking and search indexes", async (client) => {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_spaces_floor_bookable_category
        ON spaces (floor_id, priority_category, is_active, visual_only)
        INCLUDE (space_number, display_name, layout_type, layout_direction, layout_cx, layout_cy);

      CREATE INDEX IF NOT EXISTS idx_space_blocks_active_period
        ON space_blocks (space_id, block_date, start_time, end_time)
        WHERE is_active = true;

      CREATE INDEX IF NOT EXISTS idx_parking_spots_active_zone_number
        ON parking_spots (is_active, zone_id, spot_number);

      CREATE INDEX IF NOT EXISTS idx_user_vehicles_user_active_default
        ON user_vehicles (user_id, is_active, is_default, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_desc
        ON audit_logs (created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_users_search_first_name_trgm
        ON users USING gin (LOWER(first_name) gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS idx_users_search_last_name_trgm
        ON users USING gin (LOWER(last_name) gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS idx_users_search_email_trgm
        ON users USING gin (LOWER(email) gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS idx_users_search_department_trgm
        ON users USING gin (LOWER(COALESCE(department, '')) gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS idx_users_search_employee_id_trgm
        ON users USING gin (LOWER(COALESCE(employee_id, '')) gin_trgm_ops);
    `)
  })

  await step("single default vehicle data cleanup", async (client) => {
    await client.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id
                 ORDER BY is_default DESC, updated_at DESC, id DESC
               ) AS rn
        FROM user_vehicles
        WHERE is_active = true
      )
      UPDATE user_vehicles uv
         SET is_default = ranked.rn = 1,
             updated_at = NOW()
      FROM ranked
      WHERE ranked.id = uv.id
        AND uv.is_default IS DISTINCT FROM (ranked.rn = 1);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_vehicles_one_default_active
        ON user_vehicles (user_id)
        WHERE is_active = true AND is_default = true;
    `)
  })

  await step("single default vehicle trigger", async (client) => {
    await client.query(`
      CREATE OR REPLACE FUNCTION workhub_enforce_single_default_vehicle()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.is_active = true AND NEW.is_default = true THEN
          UPDATE user_vehicles
             SET is_default = false,
                 updated_at = NOW()
           WHERE user_id = NEW.user_id
             AND id <> COALESCE(NEW.id, -1)
             AND is_active = true
             AND is_default = true;
        END IF;

        RETURN NEW;
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_user_vehicles_single_default ON user_vehicles;
      CREATE TRIGGER trg_user_vehicles_single_default
      BEFORE INSERT OR UPDATE OF user_id, is_active, is_default ON user_vehicles
      FOR EACH ROW
      EXECUTE FUNCTION workhub_enforce_single_default_vehicle();
    `)
  })

  await step("reservation helper functions", async (client) => {
    await client.query(`
      CREATE OR REPLACE FUNCTION workhub_reservation_type(
        p_space_id INTEGER,
        p_parking_spot_id INTEGER,
        p_requiere_estacionamiento BOOLEAN
      )
      RETURNS TEXT
      LANGUAGE sql
      IMMUTABLE
      AS $$
        SELECT CASE
          WHEN p_space_id IS NULL THEN 'parking_only'
          WHEN p_parking_spot_id IS NOT NULL OR p_requiere_estacionamiento = true THEN 'desk_parking'
          ELSE 'desk_only'
        END
      $$;

      CREATE OR REPLACE FUNCTION workhub_count_open_checkout_candidates()
      RETURNS INTEGER
      LANGUAGE sql
      STABLE
      AS $$
        SELECT COUNT(*)::int
        FROM reservations
        WHERE status IN ('confirmada', 'activa')
          AND check_out_time IS NULL
      $$;
    `)
  })

  await step("analyze optimized tables", async (client) => {
    await client.query(`
      ANALYZE reservations;
      ANALYZE spaces;
      ANALYZE space_blocks;
      ANALYZE parking_spots;
      ANALYZE user_vehicles;
      ANALYZE users;
      ANALYZE audit_logs;
    `)
  })

  const summary = await pool.query(`
    SELECT json_build_object(
      'open_checkout_candidates', workhub_count_open_checkout_candidates(),
      'single_default_vehicle_index', (
        SELECT COUNT(*)::int FROM pg_indexes WHERE indexname = 'idx_user_vehicles_one_default_active'
      ),
      'reservation_period_index', (
        SELECT COUNT(*)::int FROM pg_indexes WHERE indexname = 'idx_reservations_admin_period_cover'
      ),
      'search_indexes', (
        SELECT COUNT(*)::int
        FROM pg_indexes
        WHERE indexname IN (
          'idx_users_search_first_name_trgm',
          'idx_users_search_last_name_trgm',
          'idx_users_search_email_trgm',
          'idx_users_search_department_trgm',
          'idx_users_search_employee_id_trgm'
        )
      )
    ) AS summary
  `)

  console.log(JSON.stringify({
    migration: "hu27_final_performance_quality",
    summary: summary.rows[0]?.summary,
  }, null, 2))
}

main()
  .then(async () => {
    await pool.end()
  })
  .catch(async (error) => {
    console.error("HU27 final performance and quality migration failed:", error)
    await pool.end()
    process.exit(1)
  })
