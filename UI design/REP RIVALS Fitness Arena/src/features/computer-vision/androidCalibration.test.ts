import { describe, expect, it } from "vitest"
import { sideDiagnostics } from "./calibrationDiagnostics"
import { SIDES } from "./geometry"
import { PoseTracker } from "./poseTracker"
import { AutoStartCountdown } from "../solo-training/autoStartCountdown"
import type { Landmark } from "./types"

function plank(hipOffsetPx = 0, visibility = 0.95, rightSide = false): Landmark[] {
  const points = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }))
  for (const side of ["left", "right"] as const) {
    if (side === "right" && !rightSide) continue
    const offset = side === "left" ? hipOffsetPx : 0
    const px = [[96,240], [96,292], [96,345], [216,240 + offset], [312,240], [408,240]]
    SIDES[side].forEach((id, i) => {
      points[id] = { x: px[i][0] / 480, y: px[i][1] / 640,
        visibility: side === "right" ? 0.90 : i === 3 ? visibility : 0.95 }
    })
  }
  return points
}

function preview(android = true) {
  const tracker = new PoseTracker("fixture", android)
  let now = -60
  const frame = (points = plank(), step = 60) => {
    now += step
    return tracker.update(points, 480, 640, now).snapshot
  }
  const hold = (n: number, points = plank()) => {
    for (let i = 0; i < n; i++) frame(points)
  }
  return { frame, hold, tracker }
}

describe("Android starting-plank evidence", () => {
  it.each([
    ["confidence", plank(), plank(0, 0.59)],
    ["4 px hip jitter", plank(38), plank(42)],
  ] as const)("pauses for an isolated %s failure without crediting the gap", (_label, valid, rejected) => {
    const p = preview()
    p.hold(18, valid)
    expect(p.frame(rejected)).toMatchObject({ calibrationProgress: 0.85, calibrated: false, state: "TRACKING_LOST" })
    expect(p.tracker.hold?.observations).toBe(18)
    expect(p.frame(valid).calibrationProgress).toBe(0.85)
    p.hold(2, valid)
    expect(p.frame(valid)).toMatchObject({ calibrated: true, totalAcceptedReps: 0 })
  })

  it("keeps desktop's uninterrupted hold and Android's clean-plank duration", () => {
    const desktop = preview(false), android = preview()
    desktop.hold(18)
    expect(desktop.frame(plank(0, 0.59)).calibrationProgress).toBe(0)
    android.hold(19)
    expect(android.frame().calibrated).toBe(false)
    expect(android.frame().calibrated).toBe(true)
  })

  it("discards persistent or repeated marginal hip observations", () => {
    const p = preview()
    p.hold(18)
    p.hold(4, plank(0, 0.59))
    expect(p.tracker.hold?.observations).toBe(0)
    expect(p.frame().calibrationProgress).toBe(0)
    p.hold(3)
    for (let i = 0; i < 80; i++) {
      expect(p.frame(i % 2 ? plank() : plank(0, 0.59)).calibrated).toBe(false)
    }
    p.hold(22)
    expect(p.tracker.snapshot().calibrated).toBe(true)
  })

  it.each(["missing hip", "outside margin", "other joint", "misalignment", "zero poses"])(
    "immediately resets for %s and recovers only on a fresh hold", kind => {
      const p = preview()
      p.hold(18)
      const points = plank(kind === "misalignment" ? 65 : 0)
      if (kind === "missing hip") delete points[23]
      if (kind === "outside margin") points[23].x = 1
      if (kind === "other joint") points[27].visibility = 0.59
      const invalid = kind === "zero poses" ? [] : points
      expect(p.frame(invalid).calibrationProgress).toBe(0)
      p.hold(30, invalid)
      expect(p.tracker.snapshot().calibrated).toBe(false)
      expect(p.frame().calibrationProgress).toBe(0)
      p.hold(20)
      expect(p.tracker.snapshot().calibrated).toBe(true)
    })

  it("needs twelve fresh observations and clears evidence across a stale gap", () => {
    const p = preview()
    for (let i = 0; i < 11; i++) expect(p.frame(plank(), 180).calibrated).toBe(false)
    for (let i = 0; i < 20; i++) expect(p.frame(plank(), 0).calibrated).toBe(false)
    expect(p.frame(plank(), 180).calibrated).toBe(true)
    expect(p.frame(plank(), 401).calibrationProgress).toBe(0)
  })

  it("identifies insufficient horizontal span even when the hip is confident and straight", () => {
    const points = plank()
    for (const p of points) p.x = 0.3 + p.x / 3
    const t = new PoseTracker("span", true)
    for (let now = 0; now <= 1800; now += 60) {
      const result = t.update(points, 480, 640, now)
      expect(result.rejection).toContain("104.0 px of the required 120.0 px")
      expect(result.snapshot.calibrated).toBe(false)
    }
  })

  it("selects the side that can calibrate and keeps its evidence on that side", () => {
    const p = preview()
    p.hold(21, plank(65, 0.95, true))
    expect(p.tracker.snapshot()).toMatchObject({ calibrated: true, selectedTrackingSide: "right" })
    const both = plank(0, 1, true)
    expect(p.frame(both).selectedTrackingSide).toBe("right")
    expect(p.frame(plank()).calibrated).toBe(false)
    expect(p.frame(plank()).calibrationProgress).toBe(0)
  })

  it("cancels Auto Start on a bad hip frame after calibration", () => {
    const p = preview(), countdown = new AutoStartCountdown()
    p.hold(21)
    for (let now = 0; now <= 4500; now += 60) {
      const s = p.frame()
      expect(countdown.update(now, s.calibrated && s.state === "TOP_CONFIRMED")).toBeGreaterThan(0)
    }
    const lost = p.frame(plank(0, 0.59))
    expect(countdown.update(4560, lost.calibrated && lost.state === "TOP_CONFIRMED")).toBeNull()
    expect(lost.totalAcceptedReps).toBe(0)
  })

  it("uses strict raw hip validation during counting and rejects an incomplete cycle", () => {
    const p = preview()
    p.hold(21)
    p.tracker.counter.setCounting(true)
    p.hold(6)
    const partial = plank()
    partial[13].x += 0.055
    p.hold(8, partial)
    p.hold(8)
    expect(p.frame(plank(0, 0.59))).toMatchObject({ state: "TRACKING_LOST", totalAcceptedReps: 0 })
    p.hold(8)
    expect(p.frame().totalAcceptedReps).toBe(0)
  })

  it("identifies the joint gate and reports optional presence and native-pixel movement", () => {
    const points = plank(42)
    points[23].presence = 0.98
    const d = sideDiagnostics(points, "left", 480, 640, plank(38)[23])
    expect(d.joints).toHaveLength(6)
    expect(d.joints[3].point.presence).toBe(0.98)
    expect(d.joints[0].point.presence).toBeUndefined()
    expect(d.hipDelta).toBeCloseTo(4)
    expect(d.gate).toContain("Hip angle 148.37°")
    points[23].visibility = 0.59
    expect(sideDiagnostics(points, "left", 480, 640).gate).toContain("hip visibility 0.590")
  })
})
