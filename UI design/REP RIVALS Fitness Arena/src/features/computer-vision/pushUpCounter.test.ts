import { describe, expect, it } from "vitest"
import { PushUpCounter } from "./pushUpCounter"

function harness(config: ConstructorParameters<typeof PushUpCounter>[0] = {}) {
  const counter = new PushUpCounter(config)
  let time = 0
  const events: number[] = []
  const hold = (angle: number | null, duration = 400, valid = true) => {
    for (let t = 0; t < duration; t += 50) {
      time += 50
      const result = counter.update({
        timestampMs: time,
        elbowAngle: angle,
        valid,
      })
      if (result.cycleDurationMs !== null)
        events.push(result.snapshot.sequenceNumber)
    }
    return counter.snapshot()
  }
  const ready = () => {
    hold(170, 1500)
    counter.setCounting(true)
    hold(170, 250)
  }
  const cycle = () => {
    hold(125, 300)
    hold(85, 400)
    hold(125, 300)
    hold(170, 400)
  }
  return { counter, hold, ready, cycle, events, now: () => time }
}
describe("push-up state machine", () => {
  it("requires sustained starting posture for calibration", () => {
    const h = harness()
    expect(h.hold(170, 1100).calibrated).toBe(false)
    expect(h.hold(170, 250).calibrated).toBe(true)
  })
  it("counts one top-bottom-top cycle exactly once", () => {
    const h = harness()
    h.ready()
    h.cycle()
    h.hold(170, 1000)
    expect(h.counter.snapshot().totalAcceptedReps).toBe(1)
    expect(h.events).toEqual([1])
  })
  it("rejects a partial descent", () => {
    const h = harness()
    h.ready()
    h.hold(125)
    h.hold(170)
    expect(h.counter.snapshot().totalAcceptedReps).toBe(0)
    expect(h.counter.snapshot().feedback).toContain("Incomplete")
  })
  it("does not count a held bottom or movement without an initial top", () => {
    const h = harness()
    h.hold(85, 2000)
    h.hold(170, 400)
    expect(h.counter.snapshot().totalAcceptedReps).toBe(0)
    h.ready()
    h.hold(85, 2000)
    expect(h.counter.snapshot().totalAcceptedReps).toBe(0)
  })
  it("does not count during calibration or preview", () => {
    const h = harness()
    h.hold(170, 1500)
    h.cycle()
    expect(h.counter.snapshot().totalAcceptedReps).toBe(0)
  })
  it("drops incomplete reps after even brief landmark loss", () => {
    const h = harness()
    h.ready()
    h.hold(85)
    h.hold(null, 50, false)
    h.hold(170, 600)
    expect(h.counter.snapshot().totalAcceptedReps).toBe(0)
    h.cycle()
    expect(h.counter.snapshot().totalAcceptedReps).toBe(1)
  })
  it("preserves count but requires recalibration after sustained loss", () => {
    const h = harness()
    h.ready()
    h.cycle()
    h.hold(null, 1500, false)
    expect(h.counter.snapshot().calibrated).toBe(false)
    expect(h.counter.snapshot().totalAcceptedReps).toBe(1)
    expect(h.hold(170, 400).calibrated).toBe(false)
    expect(h.hold(170, 1000).calibrated).toBe(true)
  })
  it("ignores duplicate and out-of-order frames", () => {
    const h = harness()
    h.ready()
    h.cycle()
    const before = h.counter.snapshot()
    for (let i = 0; i < 20; i++)
      h.counter.update({
        timestampMs: h.now(),
        valid: true,
        elbowAngle: i % 2 ? 85 : 170,
      })
    h.counter.update({ timestampMs: 0, valid: true, elbowAngle: 85 })
    expect(h.counter.snapshot()).toEqual(before)
  })
  it("does not mistake angle jitter or bottom spikes for a full cycle", () => {
    const h = harness()
    h.ready()
    for (let i = 0; i < 40; i++) h.hold(i % 2 ? 151 : 158, 50)
    h.hold(125)
    h.hold(80, 50)
    h.hold(170, 500)
    expect(h.counter.snapshot().totalAcceptedReps).toBe(0)
  })
  it("counts repeated cycles with monotonically increasing sequences", () => {
    const h = harness()
    h.ready()
    for (let i = 0; i < 5; i++) h.cycle()
    expect(h.counter.snapshot().totalAcceptedReps).toBe(5)
    expect(h.events).toEqual([1, 2, 3, 4, 5])
  })
  it("rejects implausibly rapid cycles", () => {
    const h = harness({ holdMs: 50, smoothingTimeMs: 1 })
    h.ready()
    h.hold(85, 150)
    h.hold(170, 150)
    expect(h.counter.snapshot().totalAcceptedReps).toBe(0)
  })
  it("invalidates an in-flight cycle across a skipped frame gap", () => {
    const h = harness()
    h.ready()
    h.hold(85)
    h.counter.update({
      timestampMs: h.now() + 600,
      valid: true,
      elbowAngle: 170,
    })
    h.counter.update({
      timestampMs: h.now() + 800,
      valid: true,
      elbowAngle: 170,
    })
    expect(h.counter.snapshot().totalAcceptedReps).toBe(0)
  })
  it("invalidates excessively long cycles", () => {
    const h = harness()
    h.ready()
    h.hold(85, 16000)
    h.hold(170, 500)
    expect(h.counter.snapshot().totalAcceptedReps).toBe(0)
  })
  it("resets calibration after posture changes in preview", () => {
    const h = harness()
    h.hold(170, 1500)
    h.hold(85, 500)
    expect(h.counter.snapshot().calibrated).toBe(false)
  })
  it("recalibration keeps accepted reps and clears pending movement", () => {
    const h = harness()
    h.ready()
    h.cycle()
    h.hold(85)
    h.counter.recalibrate()
    h.hold(170, 1600)
    expect(h.counter.snapshot().totalAcceptedReps).toBe(1)
  })
  it("rejects nonfinite angles and timestamps", () => {
    const h = harness()
    h.ready()
    h.hold(NaN)
    expect(h.counter.snapshot().state).toBe("TRACKING_LOST")
    const before = h.counter.snapshot()
    h.counter.update({ timestampMs: NaN, valid: true, elbowAngle: 170 })
    expect(h.counter.snapshot()).toEqual(before)
  })
})
