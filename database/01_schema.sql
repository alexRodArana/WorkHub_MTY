-- WorkHub MTY consolidated Supabase schema.
-- Run this on an empty Supabase PostgreSQL database before seeding data.

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL,
  permissions VARCHAR(500) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  employee_id VARCHAR(50) NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL,
  department VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  profile_photo_url TEXT
);

CREATE TABLE IF NOT EXISTS user_roles (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT user_roles_user_role_unique UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS buildings (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(255) NOT NULL,
  total_spaces INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS floors (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  building_id INTEGER NOT NULL REFERENCES buildings(id),
  floor_number INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  total_spaces INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  plan_image_url VARCHAR(255),
  CONSTRAINT floors_building_number_unique UNIQUE (building_id, floor_number)
);

CREATE TABLE IF NOT EXISTS spaces (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  floor_id INTEGER NOT NULL REFERENCES floors(id),
  space_number VARCHAR(50) NOT NULL,
  priority_category VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  layout_type VARCHAR(10),
  layout_direction VARCHAR(5),
  layout_cx DOUBLE PRECISION,
  layout_cy DOUBLE PRECISION,
  layout_points JSONB,
  visual_only BOOLEAN NOT NULL DEFAULT false,
  display_name VARCHAR(140),
  CONSTRAINT spaces_floor_number_unique UNIQUE (floor_id, space_number),
  CONSTRAINT chk_priority_category CHECK (
    priority_category IS NULL OR priority_category IN (
      'escritorio', 'colaborativo', 'work_lab', 'phone_booth', 'garage'
    )
  )
);

CREATE TABLE IF NOT EXISTS parking_zones (
  id SERIAL PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE,
  priority_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parking_spots (
  id SERIAL PRIMARY KEY,
  zone_id INTEGER NOT NULL REFERENCES parking_zones(id),
  spot_number VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT parking_spots_zone_number_unique UNIQUE (zone_id, spot_number)
);

CREATE TABLE IF NOT EXISTS user_vehicles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alias VARCHAR(80),
  plate VARCHAR(20) NOT NULL,
  make VARCHAR(80),
  model VARCHAR(80),
  color VARCHAR(40),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_vehicles_user_plate_unique UNIQUE (user_id, plate)
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  space_id INTEGER REFERENCES spaces(id),
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'confirmada',
  check_in_time TIMESTAMP,
  check_out_time TIMESTAMP,
  grace_period_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reservation_code VARCHAR(8) UNIQUE,
  requiere_estacionamiento BOOLEAN NOT NULL DEFAULT false,
  parking_spot_id INTEGER REFERENCES parking_spots(id),
  vehicle_id INTEGER REFERENCES user_vehicles(id),
  CONSTRAINT chk_reservation_status CHECK (status IN ('confirmada', 'activa', 'cancelada', 'no_show')),
  CONSTRAINT reservations_space_or_parking_chk CHECK (space_id IS NOT NULL OR requiere_estacionamiento = true),
  CONSTRAINT reservations_parking_vehicle_chk CHECK (parking_spot_id IS NULL OR vehicle_id IS NOT NULL),
  CONSTRAINT reservations_valid_time_chk CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS user_streaks (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_check_in_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  key VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS area_blocks (
  id SERIAL PRIMARY KEY,
  floor_id INTEGER NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  priority_category TEXT NOT NULL CHECK (
    priority_category IN ('escritorio', 'colaborativo', 'work_lab', 'phone_booth', 'garage')
  ),
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT area_blocks_unique_area UNIQUE (floor_id, priority_category)
);

CREATE TABLE IF NOT EXISTS space_blocks (
  id SERIAL PRIMARY KEY,
  space_id INTEGER NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  block_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT space_blocks_valid_time CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id VARCHAR(80),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_search_lower_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_search_role ON users (role, is_active, first_name, last_name, email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique ON users (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id_unique ON users (employee_id);
CREATE INDEX IF NOT EXISTS idx_users_first_name_trgm ON users USING gin ((LOWER(first_name)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_last_name_trgm ON users USING gin ((LOWER(last_name)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin ((LOWER(email)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_department_trgm ON users USING gin ((LOWER(department)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_employee_id_trgm ON users USING gin ((LOWER(employee_id)) gin_trgm_ops);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_name_lower_unique ON roles (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_role_unique ON user_roles (user_id, role_id);

CREATE INDEX IF NOT EXISTS idx_floors_active_order ON floors (is_active, floor_number, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_floors_building_number_unique ON floors (building_id, floor_number);

CREATE INDEX IF NOT EXISTS idx_spaces_floor_id ON spaces(floor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_floor_number_unique ON spaces (floor_id, space_number);
CREATE INDEX IF NOT EXISTS idx_spaces_active_floor_category
  ON spaces (floor_id, priority_category)
  WHERE is_active = true AND COALESCE(visual_only, false) = false;
CREATE INDEX IF NOT EXISTS idx_spaces_admin_active
  ON spaces (is_active, visual_only, floor_id, priority_category);
CREATE INDEX IF NOT EXISTS idx_spaces_floor_active_layout_order
  ON spaces (floor_id, is_active, visual_only, layout_cy, layout_cx)
  INCLUDE (space_number, priority_category, display_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parking_zones_name_lower_unique ON parking_zones (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_parking_spots_zone_number_unique ON parking_spots (zone_id, spot_number);
CREATE INDEX IF NOT EXISTS idx_parking_spots_active_zone
  ON parking_spots (zone_id, spot_number)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_vehicles_user_active
  ON user_vehicles (user_id, is_active, is_default);
CREATE INDEX IF NOT EXISTS idx_user_vehicles_plate_search ON user_vehicles (plate);
CREATE INDEX IF NOT EXISTS idx_user_vehicles_plate_lower ON user_vehicles (LOWER(plate));
CREATE INDEX IF NOT EXISTS idx_user_vehicles_plate_trgm ON user_vehicles USING gin ((LOWER(plate)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_vehicles_alias_trgm ON user_vehicles USING gin ((LOWER(COALESCE(alias, ''))) gin_trgm_ops);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_vehicles_single_default
  ON user_vehicles (user_id)
  WHERE is_active = true AND is_default = true;

CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date_status ON reservations(reservation_date, status);
CREATE INDEX IF NOT EXISTS idx_reservations_space_date ON reservations(space_id, reservation_date);
CREATE INDEX IF NOT EXISTS idx_reservations_parking_spot
  ON reservations(parking_spot_id)
  WHERE parking_spot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_vehicle_id
  ON reservations(vehicle_id)
  WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_admin_daily
  ON reservations (reservation_date, status, user_id, space_id, parking_spot_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_reservations_date_status_time
  ON reservations (reservation_date, status, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_reservations_user_status_date_time
  ON reservations (user_id, status, reservation_date, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_reservations_workspace_overlap
  ON reservations (space_id, reservation_date, start_time, end_time)
  WHERE space_id IS NOT NULL AND status IN ('confirmada', 'activa');
CREATE INDEX IF NOT EXISTS idx_reservations_parking_overlap
  ON reservations (parking_spot_id, reservation_date, start_time, end_time)
  WHERE parking_spot_id IS NOT NULL AND status IN ('confirmada', 'activa');
CREATE INDEX IF NOT EXISTS idx_reservations_user_office_overlap
  ON reservations (user_id, reservation_date, start_time, end_time)
  WHERE space_id IS NOT NULL AND status IN ('confirmada', 'activa');
CREATE INDEX IF NOT EXISTS idx_reservations_user_parking_overlap
  ON reservations (user_id, reservation_date, start_time, end_time)
  WHERE parking_spot_id IS NOT NULL AND status IN ('confirmada', 'activa');
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

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

CREATE INDEX IF NOT EXISTS area_blocks_active_idx
  ON area_blocks (floor_id, priority_category)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_space_blocks_active_lookup
  ON space_blocks (space_id, block_date, start_time, end_time)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_space_blocks_date ON space_blocks (block_date, is_active);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_action ON audit_logs (created_at DESC, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_trgm ON audit_logs USING gin ((LOWER(action)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_trgm ON audit_logs USING gin ((LOWER(entity_type)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id_trgm ON audit_logs USING gin ((LOWER(COALESCE(entity_id, ''))) gin_trgm_ops);

DO $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_users_touch_updated_at ON users;
CREATE TRIGGER trg_users_touch_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION workhub_touch_updated_at();

DROP TRIGGER IF EXISTS trg_reservations_touch_updated_at ON reservations;
CREATE TRIGGER trg_reservations_touch_updated_at
BEFORE UPDATE ON reservations
FOR EACH ROW EXECUTE FUNCTION workhub_touch_updated_at();

DROP TRIGGER IF EXISTS trg_user_vehicles_touch_updated_at ON user_vehicles;
CREATE TRIGGER trg_user_vehicles_touch_updated_at
BEFORE UPDATE ON user_vehicles
FOR EACH ROW EXECUTE FUNCTION workhub_touch_updated_at();

DROP TRIGGER IF EXISTS trg_area_blocks_touch_updated_at ON area_blocks;
CREATE TRIGGER trg_area_blocks_touch_updated_at
BEFORE UPDATE ON area_blocks
FOR EACH ROW EXECUTE FUNCTION workhub_touch_updated_at();

DROP TRIGGER IF EXISTS trg_space_blocks_touch_updated_at ON space_blocks;
CREATE TRIGGER trg_space_blocks_touch_updated_at
BEFORE UPDATE ON space_blocks
FOR EACH ROW EXECUTE FUNCTION workhub_touch_updated_at();

DROP TRIGGER IF EXISTS trg_reservations_prevent_conflicts ON reservations;
CREATE TRIGGER trg_reservations_prevent_conflicts
BEFORE INSERT OR UPDATE ON reservations
FOR EACH ROW EXECUTE FUNCTION workhub_prevent_reservation_conflicts();

DROP TRIGGER IF EXISTS trg_space_blocks_prevent_conflicts ON space_blocks;
CREATE TRIGGER trg_space_blocks_prevent_conflicts
BEFORE INSERT OR UPDATE ON space_blocks
FOR EACH ROW EXECUTE FUNCTION workhub_prevent_space_block_conflicts();

COMMIT;

-- Supabase Realtime publication. These statements are optional outside Supabase.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE space_blocks;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE area_blocks;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
