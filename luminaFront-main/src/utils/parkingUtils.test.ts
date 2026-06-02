import { describe, expect, it } from 'vitest'
import { isParkingEligible } from './parkingUtils'

describe('parkingUtils', () => {
  it('allows parking reservations without a minimum lead time', () => {
    expect(isParkingEligible('2099-06-01', '09:00')).toBe(true)
  })

  it('rejects parking eligibility when date or time is incomplete', () => {
    expect(isParkingEligible('', '09:00')).toBe(false)
    expect(isParkingEligible('2099-06-01', '')).toBe(false)
  })
})
