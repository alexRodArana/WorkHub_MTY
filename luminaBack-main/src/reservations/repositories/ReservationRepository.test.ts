import { describe, expect, it, vi } from "vitest"
import type { Pool } from "pg"
import { ReservationRepository } from "./ReservationRepository"

function makeRepository(query: ReturnType<typeof vi.fn>): ReservationRepository {
  return new ReservationRepository({ query } as unknown as Pool)
}

describe("ReservationRepository", () => {
  it("checks out through the database function and returns the release time", async () => {
    const checkOutTime = new Date("2099-06-01T09:45:00.000Z")
    const query = vi.fn().mockResolvedValue({ rows: [{ check_out_time: checkOutTime }] })
    const repository = makeRepository(query)

    const result = await repository.checkOut(22, 7)

    expect(result).toBe(checkOutTime)
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("workhub_checkout_reservation"),
      [22, 7]
    )
  })

  it("returns null when the checkout function reports a closed reservation", async () => {
    const query = vi.fn().mockRejectedValue({ code: "P0001" })
    const repository = makeRepository(query)

    await expect(repository.checkOut(22, 7)).resolves.toBeNull()
  })

  it("wraps unexpected checkout database errors", async () => {
    const query = vi.fn().mockRejectedValue(new Error("connection failed"))
    const repository = makeRepository(query)

    await expect(repository.checkOut(22, 7)).rejects.toMatchObject({
      code: "DATABASE_ERROR",
      statusCode: 500,
    })
  })
})
