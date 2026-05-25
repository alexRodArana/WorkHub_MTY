import "dotenv/config"
import express from "express"
import cors from "cors"
import { authRouter } from "./auth/router"
import { reservationService, reservationsRouter } from "./reservations/router"

const app = express()
const PORT = process.env.PORT ?? 3000
const rawProxy = process.env.TRUST_PROXY ?? '0'
const trustProxy: number | boolean = /^\d+$/.test(rawProxy) ? Number(rawProxy) : rawProxy === 'true'

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : true  // true = all origins (dev fallback)

app.use(cors({ origin: allowedOrigins }))
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
