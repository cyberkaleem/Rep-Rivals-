import { alignment, extractFeatures, inFrame, jointAngle, jointIssue, POSE_RULES, SIDES } from "./geometry"
import { COUNTER_CONFIG } from "./pushUpCounter"
import type { Landmark, TrackingSide } from "./types"

// These bands can only pause a hold. They never admit a pose or award time.
export const HIP_HOLD = {
  minObservations: 12,
  interruptionBudgetMs: 180,
  visibilityBand: 0.05,
  alignmentBandDegrees: 3,
  maxDisplacementFraction: 0.01, // fraction of the decoded frame diagonal
  historySize: 3,
}

export class AndroidCalibration {
  observations = 0
  validMs = 0
  paused = false
  private lastGood: number | null = null
  private spentMs = 0
  private history: { x: number; y: number; time: number }[] = []

  reset() {
    this.observations = 0
    this.validMs = 0
    this.paused = false
    this.lastGood = null
    this.spentMs = 0
    this.history = []
  }

  get progress() {
    return Math.min(1, this.validMs / COUNTER_CONFIG.calibrationMs,
      this.observations / HIP_HOLD.minObservations)
  }

  update(points: Landmark[], side: TrackingSide | null, width: number, height: number,
    now: number, angles: ReturnType<typeof alignment> | null, valid: boolean) {
    if (!side || !angles) {
      this.reset()
      return 0
    }
    const hip = points[SIDES[side][3]]
    const gap = this.lastGood === null ? 0 : now - this.lastGood
    if (gap > COUNTER_CONFIG.maxFrameGapMs ||
        (this.paused && this.spentMs + gap > HIP_HOLD.interruptionBudgetMs)) this.reset()

    if (valid && angles.elbow !== null && angles.elbow >= COUNTER_CONFIG.topAngle) {
      if (this.lastGood !== null) {
        if (this.paused) this.spentMs += gap
        else this.validMs += gap
      }
      this.lastGood = now
      this.observations++
      this.paused = false
      this.history.push({ x: hip.x, y: hip.y, time: now })
      if (this.history.length > HIP_HOLD.historySize) this.history.shift()
      return this.progress
    }

    if (this.lastGood !== null && this.progress < 1 &&
        this.spentMs + gap <= HIP_HOLD.interruptionBudgetMs &&
        this.isMarginalHip(points, side, width, height, now, angles)) {
      this.paused = true
      return this.progress
    }
    this.reset()
    return 0
  }

  private isMarginalHip(points: Landmark[], side: TrackingSide, width: number, height: number,
    now: number, a: ReturnType<typeof alignment>) {
    const [shoulder, , , h, , ankle] = SIDES[side]
    const hip = points[h]
    if (!inFrame(hip) || !Number.isFinite(hip.visibility) ||
        hip.visibility! < POSE_RULES.visibility - HIP_HOLD.visibilityBand ||
        SIDES[side].some(i => i !== h && jointIssue(points[i])) ||
        a.elbow === null || a.elbow < COUNTER_CONFIG.topAngle ||
        a.knee === null || a.knee < POSE_RULES.minAlignment ||
        a.hip === null || a.hip < POSE_RULES.minAlignment - HIP_HOLD.alignmentBandDegrees ||
        a.span < POSE_RULES.minBodySpan || a.slope > POSE_RULES.maxBodySlope ||
        a.wristDrop < POSE_RULES.minWristDrop) return false

    const recent = this.history.filter(p => now - p.time <= HIP_HOLD.interruptionBudgetMs)
    if (!recent.length) return false
    const mean = {
      x: recent.reduce((sum, p) => sum + p.x, 0) / recent.length,
      y: recent.reduce((sum, p) => sum + p.y, 0) / recent.length,
    }
    const displacement = Math.hypot((mean.x - hip.x) * width, (mean.y - hip.y) * height)
    const referenceAngle = jointAngle(points[shoulder], mean, points[ankle], width, height)
    return displacement <= HIP_HOLD.maxDisplacementFraction * Math.hypot(width, height) &&
      referenceAngle !== null && referenceAngle >= POSE_RULES.minAlignment
  }
}

/** Before locking a side, prefer an observable starting plank on either side. */
export function startingSide(points: Landmark[], preferred: TrackingSide | null,
  width: number, height: number, locked: TrackingSide | null): TrackingSide | null {
  if (!preferred) return locked
  const first = locked ?? preferred
  for (const side of [first, first === "left" ? "right" : "left"] as const) {
    const f = extractFeatures(points, side, width, height)
    if (f.valid && f.elbowAngle !== null && f.elbowAngle >= COUNTER_CONFIG.topAngle) return side
  }
  return first
}
