import { Router } from "express"
import { Pool } from "pg"
import rateLimit from "express-rate-limit"
import { requireAuth, requireRole } from "../shared/auth"
import { SpaceRepository } from "./repositories/SpaceRepository"
import { ReservationRepository } from "./repositories/ReservationRepository"
import { FloorRepository } from "./repositories/FloorRepository"
import { ParkingRepository } from "./repositories/ParkingRepository"
import { StreakRepository } from "./repositories/StreakRepository"
import { BadgeRepository } from "./repositories/BadgeRepository"
import { ReservationService } from "./services/ReservationService"
import { BadgeService } from "./services/BadgeService"
import { ReservationController } from "./controllers/ReservationController"
import { FloorController } from "./controllers/FloorController"
import { AdminController } from "./controllers/AdminController"
import { GuardController } from "./controllers/GuardController"
import { RealtimeController } from "./controllers/RealtimeController"
import { ReservationAssistantController } from "./controllers/ReservationAssistantController"
import { reservationEventHub } from "./realtime/ReservationEventHub"

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const spaceRepository       = new SpaceRepository(db)
const reservationRepository = new ReservationRepository(db)
const floorRepository       = new FloorRepository(db)
const parkingRepository     = new ParkingRepository(db)
const streakRepository      = new StreakRepository(db)
const badgeRepository       = new BadgeRepository(db)
const badgeService          = new BadgeService(badgeRepository)

export const reservationService = new ReservationService(
  spaceRepository,
  reservationRepository,
  parkingRepository,
  streakRepository,
  badgeService
)

const reservationController = new ReservationController(
  reservationService,
  reservationRepository,
  streakRepository,
  badgeService,
  reservationEventHub
)
const floorController = new FloorController(floorRepository)
const adminController = new AdminController(reservationRepository, reservationEventHub)
const guardController = new GuardController(reservationRepository)
const realtimeController = new RealtimeController(reservationEventHub)
const assistantController = new ReservationAssistantController(reservationService)

export const reservationsRouter = Router()

const aiRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: "RATE_LIMIT_EXCEEDED",
      message: "Demasiadas consultas de IA. Intenta de nuevo en un minuto.",
    })
  },
})

// ── Realtime events ───────────────────────────────────────────────────────────
reservationsRouter.get("/events", (req, res) => realtimeController.stream(req, res))

// ── Reservation endpoints ──────────────────────────────────────────────────────
reservationsRouter.get("/availability",  requireAuth, (req, res) => reservationController.getAvailability(req, res))
reservationsRouter.get("/occupancy",     requireAuth, (req, res) => reservationController.getFloorOccupancy(req, res))
reservationsRouter.get("/recommendations", requireAuth, aiRateLimiter, (req, res) => reservationController.getRecommendations(req, res))
reservationsRouter.post("/assistant",    requireAuth, aiRateLimiter, (req, res) => assistantController.ask(req, res))
reservationsRouter.post("/",             requireAuth, (req, res) => reservationController.createReservation(req, res))
reservationsRouter.post("/:id/check-in", requireAuth, (req, res) => reservationController.checkIn(req, res))
reservationsRouter.delete("/:id",        requireAuth, (req, res) => reservationController.cancelReservation(req, res))
reservationsRouter.get("/my",            requireAuth, (req, res) => reservationController.getMyReservations(req, res))
reservationsRouter.get("/my-stats",      requireAuth, (req, res) => reservationController.getMyStats(req, res))
reservationsRouter.get("/vehicles",      requireAuth, (req, res) => reservationController.getMyVehicles(req, res))
reservationsRouter.post("/vehicles",     requireAuth, (req, res) => reservationController.createVehicle(req, res))
reservationsRouter.put("/vehicles/:id",  requireAuth, (req, res) => reservationController.updateVehicle(req, res))
reservationsRouter.post("/vehicles/:id/default", requireAuth, (req, res) => reservationController.setDefaultVehicle(req, res))
reservationsRouter.delete("/vehicles/:id", requireAuth, (req, res) => reservationController.deleteVehicle(req, res))

// ── Admin / guard endpoints ───────────────────────────────────────────────────
reservationsRouter.get("/admin/overview", requireAuth, requireRole(["admin", "administrador"]), (req, res) => adminController.getOverview(req, res))
reservationsRouter.get("/admin/audit-logs", requireAuth, requireRole(["admin", "administrador"]), (req, res) => adminController.getAuditLogs(req, res))
reservationsRouter.post("/admin/area-blocks", requireAuth, requireRole(["admin", "administrador"]), (req, res) => adminController.blockArea(req, res))
reservationsRouter.delete("/admin/area-blocks/:id", requireAuth, requireRole(["admin", "administrador"]), (req, res) => adminController.unblockArea(req, res))
reservationsRouter.post("/admin/space-blocks", requireAuth, requireRole(["admin", "administrador"]), (req, res) => adminController.blockSpace(req, res))
reservationsRouter.delete("/admin/space-blocks/:id", requireAuth, requireRole(["admin", "administrador"]), (req, res) => adminController.unblockSpace(req, res))
reservationsRouter.get("/guard/parking", requireAuth, requireRole(["guard", "guardia"]), (req, res) => guardController.getParkingReservations(req, res))
reservationsRouter.get("/users/search", requireAuth, requireRole(["admin", "administrador", "guard", "guardia"]), (req, res) => adminController.searchUsers(req, res))

// ── Floor endpoints ────────────────────────────────────────────────────────────
reservationsRouter.get("/floors",             requireAuth, (req, res) => floorController.getFloors(req, res))
reservationsRouter.get("/floors/:id/spaces",  requireAuth, (req, res) => floorController.getFloorSpaces(req, res))
