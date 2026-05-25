-- WorkHub MTY consolidated Supabase schema.
-- Run this on an empty Supabase PostgreSQL database before seeding data.

BEGIN;

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

CREATE INDEX IF NOT EXISTS idx_spaces_floor_id ON spaces(floor_id);
CREATE INDEX IF NOT EXISTS idx_spaces_active_floor_category
  ON spaces (floor_id, priority_category)
  WHERE is_active = true AND COALESCE(visual_only, false) = false;
CREATE INDEX IF NOT EXISTS idx_spaces_admin_active
  ON spaces (is_active, visual_only, floor_id, priority_category);

CREATE INDEX IF NOT EXISTS idx_parking_spots_active_zone
  ON parking_spots (zone_id, spot_number)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_vehicles_user_active
  ON user_vehicles (user_id, is_active, is_default);
CREATE INDEX IF NOT EXISTS idx_user_vehicles_plate_search ON user_vehicles (plate);
CREATE INDEX IF NOT EXISTS idx_user_vehicles_plate_lower ON user_vehicles (LOWER(plate));
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
