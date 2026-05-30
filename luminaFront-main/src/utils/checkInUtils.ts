import type { UserReservation, ReservationStatus } from '../types/reservation'

export const CHECK_IN_POST_START_MINUTES = 30

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  confirmada: 'Confirmada',
  activa: 'Activa',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
  no_show: 'No presentó',
}

export const STATUS_COLORS: Record<ReservationStatus, { background: string; color: string }> = {
  confirmada: { background: '#e8f0ff', color: '#0055cc' },
  activa:     { background: '#e6f7f4', color: '#008c72' },
  finalizada: { background: '#eef2f7', color: '#475569' },
  cancelada:  { background: '#f4f4f4', color: '#7d7d7d' },
  no_show:    { background: '#fff3e0', color: '#cc7700' },
}

export interface CheckInAvailability {
  enabled: boolean
  buttonLabel: string
  helper: string
  tone: 'ready' | 'pending' | 'closed' | 'done'
}

export function getNormalizedDateString(value: string): string {
  return value.includes('T') ? value.slice(0, 10) : value
}

export function getTodayString(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatDate(value: string): string {
  const normalized = getNormalizedDateString(value)
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return value
  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}

export function formatDateLong(value: string): string {
  const normalized = getNormalizedDateString(value)
  const [year, month, day] = normalized.split('-').map(Number)
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(year, month - 1, day))
}

export function formatTodayFull(): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
}

export function formatTime(value: string): string {
  return value.slice(0, 5)
}

export function formatCountdown(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}

export function formatCheckInTimestamp(value?: string | null): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

export const formatCheckOutTimestamp = formatCheckInTimestamp

export function toReservationStartMs(reservation: UserReservation): number {
  const [year, month, day] = getNormalizedDateString(reservation.reservation_date).split('-').map(Number)
  const [hour, minute] = reservation.start_time.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
}

export function getGracePeriodMinutes(reservation: UserReservation): number {
  return reservation.grace_period_minutes ?? 15
}

export function getCheckInAvailability(
  reservation: UserReservation,
  nowMs: number
): CheckInAvailability {
  if (reservation.status === 'activa') {
    const checkedInTime = formatCheckInTimestamp(reservation.check_in_time)
    return {
      enabled: false,
      buttonLabel: 'Checked in',
      helper: checkedInTime ? `Check-in a las ${checkedInTime}` : 'Check-in realizado',
      tone: 'done',
    }
  }

  const reservationStartMs = toReservationStartMs(reservation)
  const gracePeriodMs = getGracePeriodMinutes(reservation) * 60 * 1000
  const opensAtMs = reservationStartMs - gracePeriodMs
  const closesAtMs = reservationStartMs + CHECK_IN_POST_START_MINUTES * 60 * 1000

  if (nowMs < opensAtMs) {
    return {
      enabled: false,
      buttonLabel: 'Check in',
      helper: `Disponible en ${formatCountdown(opensAtMs - nowMs)}`,
      tone: 'pending',
    }
  }

  if (nowMs > closesAtMs) {
    return {
      enabled: false,
      buttonLabel: 'Check in',
      helper: 'Ventana cerrada',
      tone: 'closed',
    }
  }

  return {
    enabled: true,
    buttonLabel: 'Check in',
    helper: 'Disponible ahora',
    tone: 'ready',
  }
}

export function getGreeting(firstName: string): string {
  const h = new Date().getHours()
  const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
  return firstName ? `${saludo}, ${firstName}` : saludo
}
