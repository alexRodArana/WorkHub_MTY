import type { FilterValues, ReservationErrorCode } from '../types/reservation';

export function validateFilterForm(values: FilterValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.reservation_date) {
    errors.reservation_date = 'La fecha es obligatoria';
  } else {
    const today = new Date().toISOString().slice(0, 10);
    if (values.reservation_date < today) {
      errors.reservation_date = 'La fecha no puede ser anterior a hoy';
    }
  }

  if (!values.start_time) {
    errors.start_time = 'La hora de inicio es obligatoria';
  }

  if (!values.end_time) {
    errors.end_time = 'La hora de fin es obligatoria';
  } else if (values.start_time && values.end_time <= values.start_time) {
    errors.end_time = 'La hora de fin debe ser posterior a la hora de inicio';
  }

  return errors;
}

const ERROR_MESSAGES: Record<ReservationErrorCode, string> = {
  MISSING_FIELDS: 'Faltan datos requeridos para completar la reserva.',
  INVALID_TIME_RANGE: 'El rango de horas seleccionado no es válido.',
  INVALID_DATE: 'La fecha seleccionada no es válida.',
  INVALID_ID: 'La reservación seleccionada no es válida.',
  UNAUTHORIZED: 'No tienes autorización para realizar esta acción.',
  SPACE_NOT_FOUND: 'El espacio seleccionado ya no está disponible. Por favor selecciona otro.',
  USER_CONFLICT: 'Ya tienes una reserva activa en ese horario.',
  SPACE_UNAVAILABLE: 'El espacio ya fue reservado por otro usuario. Por favor selecciona otro.',
  INVALID_STATUS: 'Ocurrió un error al procesar el estado de la reserva. Intenta de nuevo.',
  CHECK_IN_NOT_AVAILABLE_YET: 'El check-in estará disponible 15 minutos antes de la hora de inicio.',
  CHECK_IN_WINDOW_CLOSED: 'La ventana de check-in ya cerró para esta reserva.',
  CHECK_IN_OUTSIDE_ALLOWED_NETWORK: 'El check-in solo está disponible dentro de la red de la oficina.',
  CHECK_OUT_NOT_AVAILABLE: 'Esta reserva ya fue liberada o no está disponible para check-out.',
  PARKING_UNAVAILABLE: 'No hay lugares de estacionamiento disponibles para ese horario.',
  PARKING_CONFLICT: 'Ya tienes estacionamiento reservado en ese horario.',
  VEHICLE_REQUIRED: 'Agrega un vehículo antes de reservar estacionamiento.',
  VEHICLE_SELECTION_REQUIRED: 'Selecciona el vehículo que usarás para esta reserva.',
  VEHICLE_NOT_FOUND: 'El vehículo seleccionado ya no está disponible. Selecciona otro o registra uno nuevo.',
  AI_NOT_CONFIGURED: 'Falta configurar la API key de IA real en el backend.',
  AI_PROVIDER_ERROR: 'El proveedor de IA no respondió correctamente. Revisa la API key o el modelo configurado.',
  DATABASE_ERROR: 'Error interno del servidor. Intenta de nuevo más tarde.',
};

export function mapReservationError(code: string): string {
  return ERROR_MESSAGES[code as ReservationErrorCode] ?? 'Ocurrió un error inesperado. Intenta de nuevo más tarde.';
}
