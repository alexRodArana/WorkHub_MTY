import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(80) NOT NULL,
      entity_type VARCHAR(60) NOT NULL,
      entity_id VARCHAR(80),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    WITH ranked_defaults AS (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, id DESC) AS rn
      FROM user_vehicles
      WHERE is_active = true
        AND is_default = true
    )
    UPDATE user_vehicles uv
    SET is_default = false,
        updated_at = NOW()
    FROM ranked_defaults rd
    WHERE uv.id = rd.id
      AND rd.rn > 1;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_vehicles_single_default
      ON user_vehicles (user_id)
      WHERE is_active = true AND is_default = true;

    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_action
      ON audit_logs (created_at DESC, action);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
      ON audit_logs (actor_user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_reservations_user_date_status
      ON reservations (user_id, reservation_date DESC, status);

    CREATE INDEX IF NOT EXISTS idx_reservations_space_date_time
      ON reservations (space_id, reservation_date, start_time, end_time)
      WHERE space_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_reservations_parking_date_time
      ON reservations (parking_spot_id, reservation_date, start_time, end_time)
      WHERE parking_spot_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_space_blocks_space_date_time
      ON space_blocks (space_id, block_date, start_time, end_time)
      WHERE is_active = true;

    CREATE INDEX IF NOT EXISTS idx_users_search_lower_email
      ON users (LOWER(email));

    CREATE INDEX IF NOT EXISTS idx_user_vehicles_plate_lower
      ON user_vehicles (LOWER(plate));
  `);
}

main()
  .then(async () => {
    console.log("HU23 operational quality migration applied");
    await pool.end();
  })
  .catch(async (error) => {
    console.error("HU23 migration failed:", error);
    await pool.end();
    process.exit(1);
  });
