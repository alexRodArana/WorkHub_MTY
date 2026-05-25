export type ReservationErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_CATEGORY"
  | "INVALID_TIME_RANGE"
  | "INVALID_DATE"
  | "MISSING_FIELDS"
  | "INVALID_ID"
  | "SPACE_NOT_FOUND"
  | "USER_CONFLICT"
  | "SPACE_UNAVAILABLE"
  | "INVALID_STATUS"
  | "CHECK_IN_NOT_AVAILABLE_YET"
  | "CHECK_IN_WINDOW_CLOSED"
  | "CHECK_IN_OUTSIDE_ALLOWED_NETWORK"
  | "PARKING_TOO_LATE"
  | "PARKING_UNAVAILABLE"
  | "PARKING_CONFLICT"
  | "VEHICLE_REQUIRED"
  | "VEHICLE_SELECTION_REQUIRED"
  | "VEHICLE_NOT_FOUND"
  | "AI_NOT_CONFIGURED"
  | "AI_PROVIDER_ERROR"
  | "DATABASE_ERROR"

/**
 * Error personalizado para la capa de reservaciones.
 * Incluye statusCode HTTP y un código de error estandarizado.
 */
export class ReservationError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ReservationErrorCode,
    message: string
  ) {
    super(message)
    this.name = "ReservationError"
    // Necesario para que instanceof funcione correctamente con clases que extienden Error en TypeScript
    Object.setPrototypeOf(this, ReservationError.prototype)
  }
}
