import { describe, expect, it } from 'vitest'
import { getReservationIncentive } from './reservationIncentives'

describe('reservation incentives', () => {
  it('detects Tuesday taco incentive using local date parsing', () => {
    const incentive = getReservationIncentive('2026-05-26')

    expect(incentive).toMatchObject({
      kind: 'tacos',
      title: 'Martes de tacos',
    })
  })

  it('detects Thursday barista incentive using local date parsing', () => {
    const incentive = getReservationIncentive('2026-05-28')

    expect(incentive).toMatchObject({
      kind: 'barista',
      title: 'Jueves de barista',
    })
  })

  it('returns null for days without office incentives', () => {
    expect(getReservationIncentive('2026-05-27')).toBeNull()
  })

  it('returns null for invalid dates', () => {
    expect(getReservationIncentive('2026-02-31')).toBeNull()
  })
})
