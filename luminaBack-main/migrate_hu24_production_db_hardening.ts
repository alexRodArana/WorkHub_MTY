import "dotenv/config"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const SQL = `
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Base defaults expected by the application when data is inserted outside the API.
ALTER TABLE users
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE roles
  ALTER COLUMN description SET DEFAULT '',
  ALTER COLUMN permissions SET DEFAULT '';

ALTER TABLE buildings
  ALTER COLUMN total_spaces SET DEFAULT 0,
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE floors
  ALTER COLUMN total_spaces SET DEFAULT 0,
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE spaces
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN visual_only SET DEFAULT false;

ALTER TABLE reservations
  ALTER COLUMN status SET DEFAULT 'confirmada',
  ALTER COLUMN grace_period_minutes SET DEFAULT 15,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN requiere_estacionamiento SET DEFAULT false;

-- Clean existing data so production constraints can be enforced safely.
DELETE FROM user_roles ur
USING user_roles keep
WHERE ur.user_id = keep.user_id
  AND ur.role_id = keep.role_id
  AND ur.id > keep.id;

WITH duplicate_office AS (
  SELECT DISTINCT later.id
  FROM reservations later
  JOIN reservations earlier
    ON earlier.id < later.id
   AND earlier.user_id = later.user_id
   AND earlier.reservation_date = later.reservation_date
   AND earlier.status IN ('confirmada', 'activa')
   AND later.status IN ('confirmada', 'activa')
   AND earlier.space_id IS NOT NULL
   AND later.space_id IS NOT NULL
   AND earlier.start_time < later.end_time
   AND earlier.end_time > later.start_time
)
UPDATE reservations r
SET status = 'cancelada',
    updated_at = NOW()
FROM duplicate_office d
WHERE r.id = d.id;

WITH duplicate_parking AS (
  SELECT DISTINCT later.id
  FROM reservations later
  JOIN reservations earlier
    ON earlier.id < later.id
   AND earlier.user_id = later.user_id
   AND earlier.reservation_date = later.reservation_date
   AND earlier.status IN ('confirmada', 'activa')
   AND later.status IN ('confirmada', 'activa')
   AND earlier.parking_spot_id IS NOT NULL
   AND later.parking_spot_id IS NOT NULL
   AND earlier.start_time < later.end_time
   AND earlier.end_time > later.start_time
)
UPDATE reservations r
SET status = 'cancelada',
    updated_at = NOW()
FROM duplicate_parking d
WHERE r.id = d.id;

WITH users_missing_vehicle AS (
  SELECT DISTINCT user_id
  FROM reservations
  WHERE parking_spot_id IS NOT NULL
    AND vehicle_id IS NULL
),
upserted AS (
  INSERT INTO user_vehicles (
    user_id, alias, plate, make, model, color, is_default, is_active, created_at, updated_at
  )
  SELECT user_id,
         'Pendiente de registro',
         CONCAT('PEND-', user_id::text),
         NULL,
         NULL,
         NULL,
         false,
         true,
         NOW(),
         NOW()
  FROM users_missing_vehicle
  ON CONFLICT (user_id, plate)
  DO UPDATE SET alias = EXCLUDED.alias,
                is_active = true,
                updated_at = NOW()
  RETURNING id, user_id
)
UPDATE reservations r
SET vehicle_id = u.id,
    updated_at = NOW()
FROM upserted u
WHERE r.user_id = u.user_id
  AND r.parking_spot_id IS NOT NULL
  AND r.vehicle_id IS NULL;

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

-- Remove an old duplicated check name. The canonical check is reservations_space_or_parking_chk.
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS chk_reservation_space_or_parking;

-- Uniqueness that should exist in production even if older migrations missed it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id_unique ON users (employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_name_lower_unique ON roles (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_role_unique ON user_roles (user_id, role_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_floors_building_number_unique ON floors (building_id, floor_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_floor_number_unique ON spaces (floor_id, space_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parking_zones_name_lower_unique ON parking_zones (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_parking_spots_zone_number_unique ON parking_spots (zone_id, spot_number);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservations_parking_vehicle_chk'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_parking_vehicle_chk
      CHECK (parking_spot_id IS NULL OR vehicle_id IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservations_no_space_overlap'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_no_space_overlap
      EXCLUDE USING gist (
        space_id WITH =,
        tsrange((reservation_date + start_time), (reservation_date + end_time), '[)') WITH &&
      )
      WHERE (space_id IS NOT NULL AND status IN ('confirmada', 'activa'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservations_no_parking_overlap'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_no_parking_overlap
      EXCLUDE USING gist (
        parking_spot_id WITH =,
        tsrange((reservation_date + start_time), (reservation_date + end_time), '[)') WITH &&
      )
      WHERE (parking_spot_id IS NOT NULL AND status IN ('confirmada', 'activa'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservations_no_user_office_overlap'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_no_user_office_overlap
      EXCLUDE USING gist (
        user_id WITH =,
        tsrange((reservation_date + start_time), (reservation_date + end_time), '[)') WITH &&
      )
      WHERE (space_id IS NOT NULL AND status IN ('confirmada', 'activa'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservations_no_user_parking_overlap'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE reservations
      ADD CONSTRAINT reservations_no_user_parking_overlap
      EXCLUDE USING gist (
        user_id WITH =,
        tsrange((reservation_date + start_time), (reservation_date + end_time), '[)') WITH &&
      )
      WHERE (parking_spot_id IS NOT NULL AND status IN ('confirmada', 'activa'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'space_blocks_no_overlap'
      AND connamespace = current_schema()::regnamespace
  ) THEN
    ALTER TABLE space_blocks
      ADD CONSTRAINT space_blocks_no_overlap
      EXCLUDE USING gist (
        space_id WITH =,
        tsrange((block_date + start_time), (block_date + end_time), '[)') WITH &&
      )
      WHERE (is_active = true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION workhub_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_touch_updated_at ON users;
CREATE TRIGGER trg_users_touch_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION workhub_touch_updated_at();

DROP TRIGGER IF EXISTS trg_reservations_touch_updated_at ON reservations;
CREATE TRIGGER trg_reservations_touch_updated_at
BEFORE UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION workhub_touch_updated_at();

DROP TRIGGER IF EXISTS trg_user_vehicles_touch_updated_at ON user_vehicles;
CREATE TRIGGER trg_user_vehicles_touch_updated_at
BEFORE UPDATE ON user_vehicles
FOR EACH ROW
EXECUTE FUNCTION workhub_touch_updated_at();

DROP TRIGGER IF EXISTS trg_area_blocks_touch_updated_at ON area_blocks;
CREATE TRIGGER trg_area_blocks_touch_updated_at
BEFORE UPDATE ON area_blocks
FOR EACH ROW
EXECUTE FUNCTION workhub_touch_updated_at();

DROP TRIGGER IF EXISTS trg_space_blocks_touch_updated_at ON space_blocks;
CREATE TRIGGER trg_space_blocks_touch_updated_at
BEFORE UPDATE ON space_blocks
FOR EACH ROW
EXECUTE FUNCTION workhub_touch_updated_at();

CREATE OR REPLACE FUNCTION workhub_prevent_reservation_conflicts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('confirmada', 'activa') AND NEW.space_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM space_blocks sb
      WHERE sb.space_id = NEW.space_id
        AND sb.block_date = NEW.reservation_date
        AND sb.is_active = true
        AND sb.start_time < NEW.end_time
        AND sb.end_time > NEW.start_time
    ) THEN
      RAISE EXCEPTION 'SPACE_BLOCKED_FOR_RESERVATION'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.parking_spot_id IS NOT NULL AND NEW.vehicle_id IS NULL THEN
    RAISE EXCEPTION 'PARKING_REQUIRES_VEHICLE'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservations_prevent_conflicts ON reservations;
CREATE TRIGGER trg_reservations_prevent_conflicts
BEFORE INSERT OR UPDATE ON reservations
FOR EACH ROW
EXECUTE FUNCTION workhub_prevent_reservation_conflicts();

CREATE OR REPLACE FUNCTION workhub_prevent_space_block_conflicts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_active = true THEN
    IF EXISTS (
      SELECT 1
      FROM reservations r
      WHERE r.space_id = NEW.space_id
        AND r.reservation_date = NEW.block_date
        AND r.status IN ('confirmada', 'activa')
        AND r.start_time < NEW.end_time
        AND r.end_time > NEW.start_time
    ) THEN
      RAISE EXCEPTION 'SPACE_HAS_RESERVATION_FOR_BLOCK'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_space_blocks_prevent_conflicts ON space_blocks;
CREATE TRIGGER trg_space_blocks_prevent_conflicts
BEFORE INSERT OR UPDATE ON space_blocks
FOR EACH ROW
EXECUTE FUNCTION workhub_prevent_space_block_conflicts();

-- Query-path indexes for reservation creation, realtime refresh, admin KPIs, guard search and AI history.
CREATE INDEX IF NOT EXISTS idx_floors_active_order
  ON floors (is_active, floor_number, id);

CREATE INDEX IF NOT EXISTS idx_spaces_floor_active_layout_order
  ON spaces (floor_id, is_active, visual_only, layout_cy, layout_cx)
  INCLUDE (space_number, priority_category, display_name);

CREATE INDEX IF NOT EXISTS idx_reservations_pending_expiry
  ON reservations (reservation_date, end_time)
  WHERE status = 'confirmada';

CREATE INDEX IF NOT EXISTS idx_reservations_user_status_space_date
  ON reservations (user_id, status, space_id, reservation_date);

CREATE INDEX IF NOT EXISTS idx_reservations_space_status_date
  ON reservations (space_id, status, reservation_date)
  WHERE space_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_guard_daily
  ON reservations (reservation_date, status, parking_spot_id, start_time)
  INCLUDE (user_id, vehicle_id, space_id)
  WHERE parking_spot_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_ai_history
  ON reservations (reservation_date, start_time, end_time, space_id, status)
  WHERE space_id IS NOT NULL AND status IN ('confirmada', 'activa');

CREATE INDEX IF NOT EXISTS idx_users_first_name_trgm ON users USING gin ((LOWER(first_name)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_last_name_trgm ON users USING gin ((LOWER(last_name)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin ((LOWER(email)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_department_trgm ON users USING gin ((LOWER(department)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_employee_id_trgm ON users USING gin ((LOWER(employee_id)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_vehicles_plate_trgm ON user_vehicles USING gin ((LOWER(plate)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_vehicles_alias_trgm ON user_vehicles USING gin ((LOWER(COALESCE(alias, ''))) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_trgm ON audit_logs USING gin ((LOWER(action)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_trgm ON audit_logs USING gin ((LOWER(entity_type)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id_trgm ON audit_logs USING gin ((LOWER(COALESCE(entity_id, ''))) gin_trgm_ops);

ANALYZE roles;
ANALYZE users;
ANALYZE user_roles;
ANALYZE buildings;
ANALYZE floors;
ANALYZE spaces;
ANALYZE reservations;
ANALYZE parking_zones;
ANALYZE parking_spots;
ANALYZE user_vehicles;
ANALYZE area_blocks;
ANALYZE space_blocks;
ANALYZE audit_logs;
`

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured")
  }

  await pool.query(SQL)

  const result = await pool.query(`
    SELECT json_build_object(
      'duplicate_user_roles', (
        SELECT COUNT(*)::int
        FROM (
          SELECT user_id, role_id
          FROM user_roles
          GROUP BY user_id, role_id
          HAVING COUNT(*) > 1
        ) dup
      ),
      'active_space_overlaps', (
        SELECT COUNT(*)::int
        FROM reservations a
        JOIN reservations b
          ON a.id < b.id
         AND a.space_id = b.space_id
         AND a.space_id IS NOT NULL
         AND a.status IN ('confirmada', 'activa')
         AND b.status IN ('confirmada', 'activa')
         AND a.reservation_date = b.reservation_date
         AND a.start_time < b.end_time
         AND a.end_time > b.start_time
      ),
      'active_parking_overlaps', (
        SELECT COUNT(*)::int
        FROM reservations a
        JOIN reservations b
          ON a.id < b.id
         AND a.parking_spot_id = b.parking_spot_id
         AND a.parking_spot_id IS NOT NULL
         AND a.status IN ('confirmada', 'activa')
         AND b.status IN ('confirmada', 'activa')
         AND a.reservation_date = b.reservation_date
         AND a.start_time < b.end_time
         AND a.end_time > b.start_time
      ),
      'missing_vehicle_for_parking', (
        SELECT COUNT(*)::int
        FROM reservations
        WHERE parking_spot_id IS NOT NULL
          AND vehicle_id IS NULL
      )
    ) AS summary
  `)

  console.log(JSON.stringify({
    migration: "hu24_production_db_hardening",
    summary: result.rows[0]?.summary,
  }, null, 2))
}

main()
  .then(async () => {
    await pool.end()
  })
  .catch(async (error) => {
    console.error("HU24 production DB hardening failed:", error)
    await pool.end()
    process.exit(1)
  })
