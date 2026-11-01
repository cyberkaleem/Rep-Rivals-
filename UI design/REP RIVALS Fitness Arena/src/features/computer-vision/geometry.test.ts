import { describe, expect, it } from "vitest"
import { extractFeatures, jointAngle, selectSide, SIDES } from "./geometry"
import { PoseTracker } from "./poseTracker"
import type { Landmark, TrackingSide } from "./types"

function pose(side: TrackingSide = "left"): Landmark[] {
  const points = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    visibility: 0,
  }))
  const coords = [
    [0.2, 0.4],
    [0.2, 0.55],
    [0.2, 0.7],
    [0.45, 0.4],
    [0.65, 0.4],
    [0.85, 0.4],
  ]
  SIDES[side].forEach((index, n) => {
    points[index] = { x: coords[n][0], y: coords[n][1], visibility: 0.95 }
  })
  return points
}
describe("geometry and posture", () => {
  it("corrects non-square image aspect ratio", () => {
    expect(
      jointAngle({ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 1, y: 1 }, 640, 480),
    ).toBeCloseTo(123.69, 2)
  })
  it("handles degenerate and invalid vectors", () => {
    const a = { x: 0, y: 0 }
    expect(jointAngle(a, a, { x: 1, y: 1 }, 640, 480)).toBeNull()
    expect(jointAngle(a, { x: NaN, y: 0 }, a, 640, 480)).toBeNull()
  })
  it.each(["left", "right"] as const)(
    "accepts a visible %s-facing plank",
    (side) => {
      expect(selectSide(pose(side))).toBe(side)
      expect(extractFeatures(pose(side), side, 640, 480).valid).toBe(true)
    },
  )
  it("rejects no person, missing lower body and offscreen points", () => {
    expect(selectSide([])).toBeNull()
    const p = pose()
    p[27].visibility = 0.1
    expect(extractFeatures(p, "left", 640, 480).valid).toBe(false)
    p[27].visibility = 1
    p[27].x = 1.1
    expect(selectSide(p)).toBeNull()
  })
  it("rejects upright arm curls and visibly bent hips", () => {
    const p = pose()
    p[27] = { x: 0.23, y: 0.9, visibility: 1 }
    expect(extractFeatures(p, "left", 640, 480).valid).toBe(false)
    const bent = pose()
    bent[23].y = 0.2
    expect(extractFeatures(bent, "left", 640, 480).valid).toBe(false)
  })
  it("locks the side until sustained loss, then allows recalibration", () => {
    const t = new PoseTracker("test")
    for (let now = 0; now <= 1500; now += 50) t.update(pose(), 640, 480, now)
    expect(t.snapshot().calibrated).toBe(true)
    const both = pose()
    SIDES.right.forEach((i) => {
      both[i] = pose("right")[i]
    })
    SIDES.right.forEach((i) => {
      both[i].visibility = 1
    })
    expect(t.update(both, 640, 480, 1550).snapshot.selectedTrackingSide).toBe(
      "left",
    )
    for (let now = 1600; now <= 3000; now += 50)
      t.update(pose("right"), 640, 480, now)
    expect(t.snapshot().selectedTrackingSide).toBe("right")
    expect(t.snapshot().calibrated).toBe(false)
  })
  it("accepts a synthetic landmark cycle with session identity and one event", () => {
    const t = new PoseTracker("fixture-session")
    let now = 0
    const feed = (bottom: boolean, frames: number) => {
      const events = []
      for (let i = 0; i < frames; i++) {
        const p = pose()
        if (bottom) p[13] = { x: 0.32, y: 0.48, visibility: 0.95 }
        now += 50
        const event = t.update(p, 640, 480, now).rep
        if (event) events.push(event)
      }
      return events
    }
    feed(false, 30)
    t.counter.setCounting(true)
    feed(false, 6)
    feed(true, 14)
    const events = feed(false, 12)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      sessionId: "fixture-session",
      source: "camera",
      sequenceNumber: 1,
      selectedTrackingSide: "left",
    })
  })
})
