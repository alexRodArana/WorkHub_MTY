/**
 * Seeds production-like demo data for WorkHub MTY.
 *
 * Run:
 *   npx ts-node seed_production_demo_data.ts
 *
 * The script is idempotent for the demo accounts below: it updates their
 * profile/password and creates missing reservations without deleting user data.
 */

import "dotenv/config"
import bcrypt from "bcrypt"
import { Pool, PoolClient } from "pg"

type DemoRole = "employee" | "admin" | "guard"
type ReservationStatus = "confirmada" | "activa" | "cancelada" | "no_show"

type DemoUser = {
  email: string
  first_name: string
  last_name: string
  employee_id: string
  department: string
  role: DemoRole
  color: string
}

type SeedReservationPlan = {
  email: string
  dateOffset: number
  start: string
  end: string
  floorIndex?: number
  parking: boolean
  parkingOnly?: boolean
  status?: ReservationStatus
}

const DEMO_PASSWORD = "WorkHubDemo123!"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const demoUsers: DemoUser[] = [
  { email: "ana.garcia@lumina.demo", first_name: "Ana", last_name: "Garcia", employee_id: "DEMO-101", department: "People", role: "employee", color: "#a100ff" },
  { email: "diego.martinez@lumina.demo", first_name: "Diego", last_name: "Martinez", employee_id: "DEMO-102", department: "Technology", role: "employee", color: "#00a98e" },
  { email: "sofia.lopez@lumina.demo", first_name: "Sofia", last_name: "Lopez", employee_id: "DEMO-103", department: "Operations", role: "employee", color: "#ff7a45" },
  { email: "mateo.hernandez@lumina.demo", first_name: "Mateo", last_name: "Hernandez", employee_id: "DEMO-104", department: "Finance", role: "employee", color: "#4f46e5" },
  { email: "valeria.torres@lumina.demo", first_name: "Valeria", last_name: "Torres", employee_id: "DEMO-105", department: "Marketing", role: "employee", color: "#d946ef" },
  { email: "camila.ramirez@lumina.demo", first_name: "Camila", last_name: "Ramirez", employee_id: "DEMO-106", department: "Legal", role: "employee", color: "#0284c7" },
  { email: "luis.vargas@lumina.demo", first_name: "Luis", last_name: "Vargas", employee_id: "DEMO-107", department: "Sales", role: "employee", color: "#16a34a" },
  { email: "fernanda.navarro@lumina.demo", first_name: "Fernanda", last_name: "Navarro", employee_id: "DEMO-108", department: "Product", role: "employee", color: "#ea580c" },
  { email: "javier.cortes@lumina.demo", first_name: "Javier", last_name: "Cortes", employee_id: "DEMO-109", department: "Support", role: "employee", color: "#7c3aed" },
  { email: "renata.morales@lumina.demo", first_name: "Renata", last_name: "Morales", employee_id: "DEMO-110", department: "Design", role: "employee", color: "#db2777" },
  { email: "pablo.santos@lumina.demo", first_name: "Pablo", last_name: "Santos", employee_id: "DEMO-111", department: "Data", role: "employee", color: "#0891b2" },
  { email: "mariana.flores@lumina.demo", first_name: "Mariana", last_name: "Flores", employee_id: "DEMO-112", department: "HR", role: "employee", color: "#65a30d" },
  { email: "admin.demo@lumina.demo", first_name: "Admin", last_name: "Demo", employee_id: "DEMO-ADM", department: "Workplace", role: "admin", color: "#7500c0" },
  { email: "guardia.demo@lumina.demo", first_name: "Guardia", last_name: "Demo", employee_id: "DEMO-GRD", department: "Security", role: "guard", color: "#334155" },
  { email: "guardia@lumina.demo", first_name: "Guardia", last_name: "Estacionamiento", employee_id: "DEMO-GRD-2", department: "Security", role: "guard", color: "#475569" },
]

const workSlots = [
  { start: "09:00", end: "11:00" },
  { start: "10:00", end: "12:00" },
  { start: "11:00", end: "13:00" },
  { start: "13:00", end: "15:00" },
  { start: "14:00", end: "16:00" },
  { start: "16:00", end: "18:00" },
]

function profilePhotoDataUri(user: DemoUser): string {
  const initials = `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${user.color}"/><stop offset="1" stop-color="#18151f"/></linearGradient></defs><rect width="160" height="160" rx="48" fill="url(#g)"/><circle cx="122" cy="34" r="34" fill="rgba(255,255,255,.12)"/><text x="80" y="91" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="Arial, sans-serif" font-size="52" font-weight="800">${initials}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function dateWithOffset(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

async function ensureRole(client: PoolClient, role: DemoRole): Promise<number> {
  const existing = await client.query<{ id: number }>("SELECT id FROM roles WHERE name = $1", [role])
  if (existing.rows[0]) return existing.rows[0].id

  const created = await client.query<{ id: number }>(
    "INSERT INTO roles (name, description, permissions) VALUES ($1, $2, $3) RETURNING id",
    [role, `${role} demo role`, role === "admin" ? "all" : "read,write"]
  )
  return created.rows[0].id
}

async function ensureUser(client: PoolClient, user: DemoUser, passwordHash: string): Promise<number> {
  const existing = await client.query<{ id: number }>("SELECT id FROM users WHERE email = $1", [user.email])
  const photo = profilePhotoDataUri(user)

  if (existing.rows[0]) {
    await client.query(
      `UPDATE users
       SET password_hash = $2,
           first_name = $3,
           last_name = $4,
           employee_id = $5,
           role = $6,
           department = $7,
           profile_photo_url = $8,
           is_active = true,
           updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id, passwordHash, user.first_name, user.last_name, user.employee_id, user.role, user.department, photo]
    )
    return existing.rows[0].id
  }

  const created = await client.query<{ id: number }>(
    `INSERT INTO users
       (email, password_hash, first_name, last_name, employee_id, role, department, profile_photo_url, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
     RETURNING id`,
    [user.email, passwordHash, user.first_name, user.last_name, user.employee_id, user.role, user.department, photo]
  )
  return created.rows[0].id
}

async function ensureUserRole(client: PoolClient, userId: number, roleId: number): Promise<void> {
  const existing = await client.query("SELECT id FROM user_roles WHERE user_id = $1 AND role_id = $2", [userId, roleId])
  if (existing.rows[0]) return
  await client.query("INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES ($1, $2, NOW())", [userId, roleId])
}

async function ensureVehicle(client: PoolClient, userId: number, user: DemoUser, sequence: number): Promise<number | null> {
  if (user.role !== "employee") return null

  const plate = `DEMO-${String(100 + sequence).slice(-3)}`
  const makes = ["Toyota", "Honda", "Nissan", "Mazda", "Kia", "Hyundai"]
  const models = ["Corolla", "Civic", "Sentra", "CX-30", "Forte", "Elantra"]
  const colors = ["Blanco", "Gris", "Negro", "Azul", "Rojo", "Plata"]

  await client.query("UPDATE user_vehicles SET is_default = false, updated_at = NOW() WHERE user_id = $1", [userId])

  const result = await client.query<{ id: number }>(
    `INSERT INTO user_vehicles (user_id, alias, plate, make, model, color, is_default, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, true, NOW(), NOW())
     ON CONFLICT (user_id, plate)
     DO UPDATE SET alias = EXCLUDED.alias,
                   make = EXCLUDED.make,
                   model = EXCLUDED.model,
                   color = EXCLUDED.color,
                   is_default = true,
                   is_active = true,
                   updated_at = NOW()
     RETURNING id`,
    [
      userId,
      "Demo principal",
      plate,
      makes[sequence % makes.length],
      models[sequence % models.length],
      colors[sequence % colors.length],
    ]
  )
  return result.rows[0].id
}

async function getFloorIds(client: PoolClient): Promise<number[]> {
  const result = await client.query<{ id: number }>(
    "SELECT id FROM floors WHERE is_active = true ORDER BY floor_number, id"
  )
  return result.rows.map((row) => row.id)
}

async function findAvailableSpace(
  client: PoolClient,
  floorId: number,
  date: string,
  start: string,
  end: string,
  pickIndex: number
): Promise<number | null> {
  const result = await client.query<{ id: number }>(
    `SELECT s.id
     FROM spaces s
     WHERE s.floor_id = $1
       AND s.is_active = true
       AND COALESCE(s.visual_only, false) = false
       AND s.priority_category = 'escritorio'
       AND NOT EXISTS (
         SELECT 1
         FROM reservations r
         WHERE r.space_id = s.id
           AND r.reservation_date = $2
           AND r.status IN ('confirmada', 'activa')
           AND r.start_time < $4
           AND r.end_time > $3
       )
       AND NOT EXISTS (
         SELECT 1
         FROM space_blocks sb
         WHERE sb.space_id = s.id
           AND sb.block_date = $2
           AND sb.is_active = true
           AND sb.start_time < $4
           AND sb.end_time > $3
       )
     ORDER BY s.space_number`,
    [floorId, date, start, end]
  )

  if (result.rows.length === 0) return null
  return result.rows[pickIndex % result.rows.length].id
}

async function assignParkingIfNeeded(
  client: PoolClient,
  reservationId: number,
  date: string,
  start: string,
  end: string,
  pickIndex: number
): Promise<void> {
  const result = await client.query<{ id: number }>(
    `SELECT ps.id
     FROM parking_spots ps
     JOIN parking_zones pz ON pz.id = ps.zone_id
     WHERE ps.is_active = true
       AND NOT EXISTS (
         SELECT 1
         FROM reservations r
         WHERE r.parking_spot_id = ps.id
           AND r.status IN ('confirmada', 'activa')
           AND r.reservation_date = $1
           AND r.start_time < $3
           AND r.end_time > $2
       )
     ORDER BY pz.priority_order, ps.spot_number`,
    [date, start, end]
  )

  if (result.rows.length === 0) return
  await client.query("UPDATE reservations SET parking_spot_id = $1, updated_at = NOW() WHERE id = $2", [
    result.rows[pickIndex % result.rows.length].id,
    reservationId,
  ])
}

async function uniqueReservationCode(client: PoolClient, seed: number): Promise<string> {
  let attempt = 0
  while (attempt < 500) {
    const code = `PD${(seed + attempt).toString(36).toUpperCase().padStart(6, "0")}`.slice(0, 8)
    const existing = await client.query("SELECT id FROM reservations WHERE reservation_code = $1", [code])
    if (!existing.rows[0]) return code
    attempt++
  }
  throw new Error("Unable to generate unique reservation code")
}

async function ensureReservation(
  client: PoolClient,
  userId: number,
  plan: SeedReservationPlan,
  floorIds: number[],
  sequence: number,
  vehicleId: number | null
): Promise<"created" | "updated" | "skipped"> {
  const date = dateWithOffset(plan.dateOffset)
  const status = plan.status ?? "confirmada"
  const requiresParking = plan.parking || plan.parkingOnly === true
  const floorId = floorIds[(plan.floorIndex ?? sequence) % floorIds.length]
  const spaceId = plan.parkingOnly
    ? null
    : await findAvailableSpace(client, floorId, date, plan.start, plan.end, sequence)

  if (!plan.parkingOnly && !spaceId) return "skipped"

  const existing = await client.query<{ id: number }>(
    `SELECT id
     FROM reservations
     WHERE user_id = $1
       AND reservation_date = $2
       AND start_time = $3
       AND end_time = $4
       AND (($5::boolean = true AND space_id IS NULL) OR ($5::boolean = false AND space_id IS NOT NULL))
     LIMIT 1`,
    [userId, date, plan.start, plan.end, plan.parkingOnly === true]
  )

  const checkInTime = status === "activa" ? new Date() : null
  const checkOutTime = status === "no_show" || status === "cancelada" ? null : null

  if (existing.rows[0]) {
    await client.query(
      `UPDATE reservations
       SET status = $2,
           check_in_time = $3,
           check_out_time = $4,
           requiere_estacionamiento = $5,
           vehicle_id = $6,
           parking_spot_id = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id, status, checkInTime, checkOutTime, requiresParking, requiresParking ? vehicleId : null]
    )
    if (requiresParking) {
      await assignParkingIfNeeded(client, existing.rows[0].id, date, plan.start, plan.end, sequence)
    }
    return "updated"
  }

  const code = await uniqueReservationCode(client, 500000 + sequence)
  const created = await client.query<{ id: number }>(
    `INSERT INTO reservations
       (user_id, space_id, reservation_date, start_time, end_time, status,
        check_in_time, check_out_time, grace_period_minutes, created_at, updated_at,
        reservation_code, requiere_estacionamiento, vehicle_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 15, NOW(), NOW(), $9, $10, $11)
     RETURNING id`,
    [userId, spaceId, date, plan.start, plan.end, status, checkInTime, checkOutTime, code, requiresParking, requiresParking ? vehicleId : null]
  )

  if (requiresParking) {
    await assignParkingIfNeeded(client, created.rows[0].id, date, plan.start, plan.end, sequence)
  }
  return "created"
}

function buildReservationPlans(users: DemoUser[]): SeedReservationPlan[] {
  const employees = users.filter((user) => user.role === "employee")
  const plans: SeedReservationPlan[] = []

  employees.forEach((user, index) => {
    const slot = workSlots[index % workSlots.length]
    plans.push({
      email: user.email,
      dateOffset: 0,
      start: slot.start,
      end: slot.end,
      floorIndex: index,
      parking: index % 3 !== 1,
      status: index % 5 === 0 ? "activa" : "confirmada",
    })

    const tomorrowSlot = workSlots[(index + 2) % workSlots.length]
    plans.push({
      email: user.email,
      dateOffset: 1,
      start: tomorrowSlot.start,
      end: tomorrowSlot.end,
      floorIndex: index + 1,
      parking: index % 2 === 0,
    })

    const futureSlot = workSlots[(index + 4) % workSlots.length]
    plans.push({
      email: user.email,
      dateOffset: 3 + (index % 4),
      start: futureSlot.start,
      end: futureSlot.end,
      floorIndex: index + 2,
      parking: index % 4 === 0,
    })

    if (index % 2 === 0) {
      const parkingSlot = workSlots[(index + 1) % workSlots.length]
      plans.push({
        email: user.email,
        dateOffset: 2 + (index % 3),
        start: parkingSlot.start,
        end: parkingSlot.end,
        parking: true,
        parkingOnly: true,
      })
    }
  })

  plans.push(
    { email: "ana.garcia@lumina.demo", dateOffset: 0, start: "08:00", end: "09:00", floorIndex: 0, parking: false, status: "no_show" },
    { email: "diego.martinez@lumina.demo", dateOffset: 0, start: "17:00", end: "18:00", floorIndex: 1, parking: false, status: "cancelada" },
    { email: "sofia.lopez@lumina.demo", dateOffset: 1, start: "08:00", end: "10:00", parking: true, parkingOnly: true },
    { email: "luis.vargas@lumina.demo", dateOffset: 0, start: "18:00", end: "20:00", parking: true, parkingOnly: true }
  )

  return plans
}

async function main(): Promise<void> {
  const client = await pool.connect()
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const userIds = new Map<string, number>()
  const vehicleIds = new Map<string, number | null>()
  let created = 0
  let updated = 0
  let skipped = 0

  try {
    await client.query("BEGIN")

    for (let index = 0; index < demoUsers.length; index++) {
      const user = demoUsers[index]
      const roleId = await ensureRole(client, user.role)
      const userId = await ensureUser(client, user, passwordHash)
      await ensureUserRole(client, userId, roleId)
      const vehicleId = await ensureVehicle(client, userId, user, index)
      userIds.set(user.email, userId)
      vehicleIds.set(user.email, vehicleId)
    }

    const floorIds = await getFloorIds(client)
    if (floorIds.length === 0) throw new Error("No active floors found")

    const plans = buildReservationPlans(demoUsers)
    for (let index = 0; index < plans.length; index++) {
      const plan = plans[index]
      const userId = userIds.get(plan.email)
      if (!userId) continue

      const result = await ensureReservation(client, userId, plan, floorIds, index + 1, vehicleIds.get(plan.email) ?? null)
      if (result === "created") created++
      if (result === "updated") updated++
      if (result === "skipped") skipped++
    }

    await client.query("COMMIT")

    console.log("Production-like demo data ready.")
    console.log(JSON.stringify({
      users: demoUsers.length,
      reservations_created: created,
      reservations_updated: updated,
      reservations_skipped: skipped,
      password: DEMO_PASSWORD,
    }, null, 2))
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Production demo seed failed:", error)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

void main()
