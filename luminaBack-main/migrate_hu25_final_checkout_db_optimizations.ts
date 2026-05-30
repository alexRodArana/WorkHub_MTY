import "dotenv/config"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const SQL = `
ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS chk_reservation_status;

ALTER TABLE reservations
  ADD CONSTRAINT chk_reservation_status
  CHECK (status IN ('confirmada', 'activa', 'finalizada', 'cancelada', 'no_show'));

CREATE INDEX IF NOT EXISTS idx_reservations_checkout_lookup
  ON reservations (id, user_id, status, check_out_time)
  WHERE status = 'activa' AND check_out_time IS NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_user_active_current
  ON reservations (user_id, reservation_date, start_time, end_time)
  INCLUDE (status, space_id, parking_spot_id, vehicle_id)
  WHERE status IN ('confirmada', 'activa');

CREATE INDEX IF NOT EXISTS idx_reservations_admin_status_daily
  ON reservations (reservation_date, status)
  INCLUDE (user_id, space_id, parking_spot_id, vehicle_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_reservations_ai_history_completed
  ON reservations (user_id, reservation_date DESC, space_id, status)
  WHERE space_id IS NOT NULL AND status IN ('confirmada', 'activa', 'finalizada');

CREATE OR REPLACE FUNCTION workhub_validate_reservation_checkout()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'finalizada' THEN
    IF OLD.status <> 'activa' THEN
      RAISE EXCEPTION 'CHECK_OUT_REQUIRES_ACTIVE_RESERVATION'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.space_id IS NULL THEN
      RAISE EXCEPTION 'CHECK_OUT_REQUIRES_WORKSPACE_RESERVATION'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.check_out_time IS NULL THEN
      NEW.check_out_time = NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservations_validate_checkout ON reservations;
CREATE TRIGGER trg_reservations_validate_checkout
BEFORE UPDATE ON reservations
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR NEW.check_out_time IS DISTINCT FROM OLD.check_out_time)
EXECUTE FUNCTION workhub_validate_reservation_checkout();

CREATE OR REPLACE FUNCTION workhub_checkout_reservation(
  p_reservation_id INTEGER,
  p_user_id INTEGER
)
RETURNS TABLE(reservation_id INTEGER, check_out_time TIMESTAMP)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE reservations r
     SET status = 'finalizada',
         check_out_time = NOW(),
         updated_at = NOW()
   WHERE r.id = p_reservation_id
     AND r.user_id = p_user_id
     AND r.status = 'activa'
     AND r.space_id IS NOT NULL
     AND r.check_out_time IS NULL
  RETURNING r.id, r.check_out_time
       INTO reservation_id, check_out_time;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHECK_OUT_NOT_AVAILABLE'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION workhub_expire_finished_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE reservations
     SET status = 'no_show',
         updated_at = NOW()
   WHERE status = 'confirmada'
     AND space_id IS NOT NULL
     AND (reservation_date + end_time) < NOW();

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$;

ANALYZE reservations;
ANALYZE spaces;
ANALYZE user_badges;
ANALYZE parking_spots;
`

async function main(): Promise<void> {
  await pool.query(SQL)

  const result = await pool.query(`
    SELECT json_build_object(
      'reservation_status_constraint', (
        SELECT COUNT(*)::int
        FROM pg_constraint
        WHERE conname = 'chk_reservation_status'
      ),
      'checkout_function', (
        SELECT COUNT(*)::int
        FROM pg_proc
        WHERE proname = 'workhub_checkout_reservation'
      ),
      'active_checkout_candidates', (
        SELECT COUNT(*)::int
        FROM reservations
        WHERE status = 'activa'
          AND space_id IS NOT NULL
          AND check_out_time IS NULL
      )
    ) AS summary
  `)

  console.log(JSON.stringify({
    migration: "hu25_final_checkout_db_optimizations",
    summary: result.rows[0]?.summary,
  }, null, 2))
}

main()
  .then(async () => {
    await pool.end()
  })
  .catch(async (error) => {
    console.error("HU25 final checkout DB optimizations failed:", error)
    await pool.end()
    process.exit(1)
  })
