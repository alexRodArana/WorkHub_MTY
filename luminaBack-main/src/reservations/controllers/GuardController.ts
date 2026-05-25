import { Request, Response } from "express"
import { ReservationRepository } from "../repositories/ReservationRepository"
import { ReservationError } from "../errors"

export class GuardController {
  constructor(private readonly reservationRepository: ReservationRepository) {}

  async getParkingReservations(req: Request, res: Response): Promise<void> {
    try {
      const date = typeof req.query.date === "string"
        ? req.query.date
        : new Date().toISOString().slice(0, 10)
      const query = typeof req.query.q === "string" ? req.query.q : undefined
      res.json(query
        ? await this.reservationRepository.findParkingReservationsByDate(date, query)
        : await this.reservationRepository.findParkingReservationsByDate(date)
      )
    } catch (err) {
      if (err instanceof ReservationError) {
        res.status(err.statusCode).json({ error: err.code, message: err.message })
        return
      }
      console.error("GuardController error:", err)
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Error interno del servidor" })
    }
  }
}
