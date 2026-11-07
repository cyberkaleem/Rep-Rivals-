import { describe, expect, it } from "vitest"
import { AutoStartCountdown } from "./autoStartCountdown"

describe("workout start countdown", () => {
  it("requires five continuous seconds of ready frames", () => {
    const countdown = new AutoStartCountdown()
    expect(countdown.update(0, false)).toBeNull()
    for (let elapsed = 0; elapsed < 5000; elapsed += 100) {
      expect(countdown.update(9000 + elapsed, true)).toBe(5 - Math.floor(elapsed / 1000))
    }
    expect(countdown.update(13999, true)).toBe(1)
    expect(countdown.update(14000, true)).toBe(0)
  })

  it("discards the deadline when tracking is interrupted, even at expiry", () => {
    const countdown = new AutoStartCountdown()
    for (let now = 0; now < 5000; now += 100) countdown.update(now, true)
    expect(countdown.update(5000, false)).toBeNull()
    expect(countdown.update(5100, true)).toBe(5)
  })

  it("restarts on a gap when no intervening tracking-lost frame was delivered", () => {
    const countdown = new AutoStartCountdown()
    for (let now = 0; now <= 4600; now += 100) countdown.update(now, true)
    expect(countdown.update(5100, true)).toBe(5)
    countdown.reset()
    expect(countdown.update(5200, true)).toBe(5)
  })
})
