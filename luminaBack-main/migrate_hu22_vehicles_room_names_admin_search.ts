import "dotenv/config"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function main(): Promise<void> {
  await pool.query(`
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

    ALTER TABLE reservations
      ADD COLUMN IF NOT EXISTS vehicle_id INTEGER REFERENCES user_vehicles(id);

    ALTER TABLE spaces
      ADD COLUMN IF NOT EXISTS display_name VARCHAR(140);

    UPDATE spaces SET display_name = CASE space_number
      WHEN 'PB-A1' THEN 'Fundidora'
      WHEN 'PB-A2' THEN 'La Huasteca'
      WHEN 'PB-A3' THEN 'Monterrey'
      WHEN 'MZ-A1' THEN 'Sala Mitras'
      WHEN 'MZ-A2' THEN 'Chipinque'
      WHEN 'MZ-AREA-72' THEN 'Santa Lucia'
      WHEN 'P3-A1' THEN 'Sierra Madre'
      WHEN 'P3-AREA-33' THEN 'La Silla'
      WHEN 'P9-A1' THEN 'Estanzuela'
      WHEN 'P9-A2' THEN 'Area Colaborativa AC-9091'
      WHEN 'P9-A3' THEN 'Area D.T. SJ-9088'
      ELSE display_name
    END
    WHERE space_number IN (
      'PB-A1', 'PB-A2', 'PB-A3',
      'MZ-A1', 'MZ-A2', 'MZ-AREA-72',
      'P3-A1', 'P3-AREA-33',
      'P9-A1', 'P9-A2', 'P9-A3'
    );

    INSERT INTO user_vehicles (user_id, alias, plate, make, model, color, is_default, is_active, created_at, updated_at)
    SELECT u.id,
           'Demo principal',
           CONCAT('DEMO-', RIGHT(REGEXP_REPLACE(COALESCE(u.employee_id, u.id::text), '[^0-9]', '', 'g'), 3)),
           CASE (u.id % 4)
             WHEN 0 THEN 'Toyota'
             WHEN 1 THEN 'Honda'
             WHEN 2 THEN 'Nissan'
             ELSE 'Mazda'
           END,
           CASE (u.id % 4)
             WHEN 0 THEN 'Corolla'
             WHEN 1 THEN 'Civic'
             WHEN 2 THEN 'Sentra'
             ELSE 'CX-30'
           END,
           CASE (u.id % 5)
             WHEN 0 THEN 'Blanco'
             WHEN 1 THEN 'Gris'
             WHEN 2 THEN 'Negro'
             WHEN 3 THEN 'Azul'
             ELSE 'Rojo'
           END,
           true,
           true,
           NOW(),
           NOW()
    FROM users u
    WHERE u.email LIKE '%@lumina.demo'
      AND u.role = 'employee'
    ON CONFLICT (user_id, plate)
    DO UPDATE SET alias = EXCLUDED.alias,
                  make = EXCLUDED.make,
                  model = EXCLUDED.model,
                  color = EXCLUDED.color,
                  is_default = true,
                  is_active = true,
                  updated_at = NOW();

    UPDATE reservations r
    SET vehicle_id = uv.id,
        updated_at = NOW()
    FROM user_vehicles uv
    WHERE uv.user_id = r.user_id
      AND uv.is_active = true
      AND uv.is_default = true
      AND r.vehicle_id IS NULL
      AND (r.parking_spot_id IS NOT NULL OR r.requiere_estacionamiento = true);

    CREATE INDEX IF NOT EXISTS idx_user_vehicles_user_active
      ON user_vehicles (user_id, is_active, is_default);

    CREATE INDEX IF NOT EXISTS idx_user_vehicles_plate_search
      ON user_vehicles (plate);

    CREATE INDEX IF NOT EXISTS idx_reservations_vehicle_id
      ON reservations (vehicle_id)
      WHERE vehicle_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_users_search_role
      ON users (role, is_active, first_name, last_name, email);
  `)
}

main()
  .then(async () => {
    console.log("HU22 vehicles, room names and search migration applied")
    await pool.end()
  })
  .catch(async (error) => {
    console.error("HU22 migration failed:", error)
    await pool.end()
    process.exit(1)
  })
