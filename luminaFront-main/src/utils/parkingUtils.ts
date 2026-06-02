export function isParkingEligible(date: string, startTime: string): boolean {
  if (!date || !startTime) return false

  const reservationStart = new Date(`${date}T${startTime}:00`).getTime()
  return !Number.isNaN(reservationStart)
}
