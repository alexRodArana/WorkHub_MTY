import "dotenv/config"
import express from "express"
import cors, { CorsOptions } from "cors"
import { authRouter } from "./auth/router"
import { reservationService, reservationsRouter } from "./reservations/router"

const app = express()
const PORT = process.env.PORT ?? 3000
const rawProxy = process.env.TRUST_PROXY ?? '0'
const trustProxy: number | boolean = /^\d+$/.test(rawProxy) ? Number(rawProxy) : rawProxy === 'true'

const rawAllowedOrigins = process.env.ALLOWED_ORIGINS ?? process.env.CORS_ORIGIN
const allowedOrigins = rawAllowedOrigins
  ? rawAllowedOrigins.split(',').map((o) => o.trim().replace(/\/$/, "")).filter(Boolean)
  : []
const allowedOriginSet = new Set(allowedOrigins)

function isLocalOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  } catch {
    return false
  }
}

function isVercelOrigin(origin: string): boolean {
  try {
    return new URL(origin).hostname.endsWith(".vercel.app")
  } catch {
    return false
  }
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true)
    if (allowedOrigins.length === 0) return callback(null, true)
    if (allowedOriginSet.has(origin) || isLocalOrigin(origin) || isVercelOrigin(origin)) {
      return callback(null, true)
    }
    return callback(null, false)
  },
}

app.use(cors(corsOptions))
app.use(express.json({ limit: "1mb" }))
app.set("trust proxy", trustProxy)

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "workhub-mty-api",
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
  })
})

app.use("/auth", authRouter)
app.use("/reservations", reservationsRouter)

const reservationCleanupIntervalMs = 60 * 1000
setInterval(() => {
  reservationService.expireMissedReservations().catch((error) => {
    console.error("Reservation cleanup failed:", error)
  })
}, reservationCleanupIntervalMs)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app
