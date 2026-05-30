export type ReservationIncentiveKind = 'tacos' | 'barista'

export interface ReservationIncentive {
  key: string
  kind: ReservationIncentiveKind
  title: string
  message: string
  label: string
}

function parseLocalDate(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

export function getReservationIncentive(dateValue: string): ReservationIncentive | null {
  const date = parseLocalDate(dateValue)
  if (!date) return null

  const day = date.getDay()

  if (day === 2) {
    return {
      key: `${dateValue}:tacos`,
      kind: 'tacos',
      title: 'Martes de tacos',
      message: 'Recuerda que este día puedes disfrutar de tacos como incentivo por asistir a la oficina.',
      label: 'MT',
    }
  }

  if (day === 4) {
    return {
      key: `${dateValue}:barista`,
      kind: 'barista',
      title: 'Jueves de barista',
      message: 'Recuerda que este día hay barista como incentivo por asistir a la oficina.',
      label: 'JB',
    }
  }

  return null
}
