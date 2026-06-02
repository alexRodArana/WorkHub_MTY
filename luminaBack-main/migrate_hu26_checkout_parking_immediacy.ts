import "dotenv/config"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const SQL = `
CREATE OR REPLACE FUNCTION workhub_validate_reservation_checkout()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'finalizada' THEN
    IF OLD.status NOT IN ('confirmada', 'activa') THEN
      RAISE EXCEPTION 'CHECK_OUT_REQUIRES_OPEN_RESERVATION'
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
     AND r.status IN ('confirmada', 'activa')
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

ANALYZE reservations;
`

async function main(): Promise<void> {
  await pool.query(SQL)

  const result = await pool.query(`
    SELECT json_build_object(
      'checkout_function', (
        SELECT COUNT(*)::int
        FROM pg_proc
        WHERE proname = 'workhub_checkout_reservation'
      ),
      'open_checkout_candidates', (
        SELECT COUNT(*)::int
        FROM reservations
        WHERE status IN ('confirmada', 'activa')
          AND check_out_time IS NULL
      )
    ) AS summary
  `)

  console.log(JSON.stringify({
    migration: "hu26_checkout_parking_immediacy",
    summary: result.rows[0]?.summary,
  }, null, 2))
}

main()
  .then(async () => {
    await pool.end()
  })
  .catch(async (error) => {
    console.error("HU26 checkout parking immediacy migration failed:", error)
    await pool.end()
    process.exit(1)
  })
