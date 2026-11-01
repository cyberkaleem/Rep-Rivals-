import type { CounterSnapshot } from "./types"

/** Starting heuristics, not validated biomechanics. Tune with real-device trials. */
export const COUNTER_CONFIG = {
  topAngle: 155,
  leaveTopAngle: 145,
  bottomAngle: 100,
  leaveBottomAngle: 110,
  holdMs: 150,
  calibrationMs: 1200,
  minCycleMs: 700,
  maxCycleMs: 15000,
  cooldownMs: 250,
  maxFrameGapMs: 400,
  recalibrateAfterMs: 1200,
  smoothingTimeMs: 70,
}
type Config = typeof COUNTER_CONFIG
export interface CounterFrame {
  timestampMs: number
  valid: boolean
  elbowAngle: number | null
  feedback?: string
}

export class PushUpCounter {
  private config: Config
  private lastFrame: number | null = null
  private lastValid: number | null = null
  private holdSince: number | null = null
  private cycleStart: number | null = null
  private counting = false
  private smoothed: number | null = null
  private data: CounterSnapshot = {
    totalAcceptedReps: 0,
    sequenceNumber: 0,
    state: "NOT_READY",
    calibrated: false,
    calibrationProgress: 0,
    angle: null,
    lastAcceptedRepTime: null,
    feedback: "Enable camera to begin.",
  }
  constructor(config: Partial<Config> = {}) {
    this.config = { ...COUNTER_CONFIG, ...config }
  }
  snapshot(): CounterSnapshot {
    return { ...this.data }
  }
  setCounting(enabled: boolean) {
    this.counting = enabled
    this.resetCycle()
    this.data.state = "NOT_READY"
  }
  recalibrate() {
    this.resetCycle()
    this.data.calibrated = false
    this.data.calibrationProgress = 0
    this.data.state = "NOT_READY"
    this.data.feedback = "Hold your starting position."
  }
  private resetCycle() {
    this.holdSince = null
    this.cycleStart = null
    this.smoothed = null
  }
  private held(condition: boolean, now: number, duration: number) {
    if (!condition) {
      this.holdSince = null
      return false
    }
    this.holdSince ??= now
    return now - this.holdSince >= duration
  }
  private move(state: CounterSnapshot["state"], feedback: string) {
    this.data.state = state
    this.data.feedback = feedback
    this.holdSince = null
  }
  update(frame: CounterFrame): {
    snapshot: CounterSnapshot
    cycleDurationMs: number | null
  } {
    const now = frame.timestampMs,
      previous = this.lastFrame
    const result = (cycleDurationMs: number | null = null) => ({
      snapshot: this.snapshot(),
      cycleDurationMs,
    })
    // Timestamps must be monotonic; duplicate/out-of-order frames never advance holds.
    if (!Number.isFinite(now) || (previous !== null && now <= previous))
      return result()
    this.lastFrame = now
    if (previous !== null && now - previous > this.config.maxFrameGapMs) {
      this.resetCycle()
      this.move(
        "TRACKING_LOST",
        "Tracking interrupted. Hold the top position again.",
      )
    }
    if (
      this.lastValid !== null &&
      now - this.lastValid >= this.config.recalibrateAfterMs
    )
      this.recalibrate()
    if (
      !frame.valid ||
      frame.elbowAngle === null ||
      !Number.isFinite(frame.elbowAngle) ||
      frame.elbowAngle < 0 ||
      frame.elbowAngle > 180
    ) {
      this.resetCycle()
      this.data.angle = null
      this.data.calibrationProgress = this.data.calibrated ? 1 : 0
      this.move(
        "TRACKING_LOST",
        frame.feedback ?? "Tracking lost. Keep your full body visible.",
      )
      return result()
    }
    this.lastValid = now
    const alpha =
      previous === null
        ? 1
        : 1 - Math.exp(-(now - previous) / this.config.smoothingTimeMs)
    this.smoothed =
      this.smoothed === null
        ? frame.elbowAngle
        : this.smoothed + alpha * (frame.elbowAngle - this.smoothed)
    const angle = this.smoothed
    this.data.angle = angle
    const top = angle >= this.config.topAngle
    const bottom = angle <= this.config.bottomAngle
    if (!this.data.calibrated) {
      const ready = this.held(top, now, this.config.calibrationMs)
      this.data.calibrationProgress =
        this.holdSince === null
          ? 0
          : Math.min(1, (now - this.holdSince) / this.config.calibrationMs)
      this.data.feedback = top
        ? "Hold your starting position."
        : "Extend your arms in the starting plank position."
      this.data.state = "NOT_READY"
      if (ready) {
        this.data.calibrated = true
        this.move("TOP_CONFIRMED", "Camera ready. Start when you are ready.")
      }
      return result()
    }
    if (!this.counting) {
      // Readiness expires if the user leaves the starting pose before pressing Start.
      if (!top) {
        this.recalibrate()
        return result()
      }
      this.move("TOP_CONFIRMED", "Camera ready. Start when you are ready.")
      return result()
    }
    if (
      this.cycleStart !== null &&
      now - this.cycleStart > this.config.maxCycleMs
    ) {
      this.resetCycle()
      this.move("NOT_READY", "Movement timed out. Hold the top position again.")
    }
    if (this.data.state === "REP_COMPLETED")
      this.move("TOP_CONFIRMED", "Rep accepted. Lower your body.")
    switch (this.data.state) {
      case "NOT_READY":
      case "TRACKING_LOST":
        this.data.feedback = "Hold the top position to resume."
        if (this.held(top, now, this.config.holdMs))
          this.move("TOP_CONFIRMED", "Ready. Lower your body.")
        break
      case "TOP_CONFIRMED":
        if (angle < this.config.leaveTopAngle) {
          this.cycleStart = now
          this.move("DESCENDING", "Lower your body.")
        }
        break
      case "DESCENDING":
        if (top) {
          this.cycleStart = null
          this.move(
            "TOP_CONFIRMED",
            "Incomplete repetition. Lower further on the next rep.",
          )
        } else if (this.held(bottom, now, this.config.holdMs))
          this.move("BOTTOM_CONFIRMED", "Push up.")
        break
      case "BOTTOM_CONFIRMED":
        if (angle > this.config.leaveBottomAngle)
          this.move("ASCENDING", "Push up. Extend your arms.")
        break
      case "ASCENDING":
        if (bottom) this.move("BOTTOM_CONFIRMED", "Push up.")
        else if (this.held(top, now, this.config.holdMs)) {
          const duration = now - (this.cycleStart ?? now)
          const cooledDown =
            this.data.lastAcceptedRepTime === null ||
            now - this.data.lastAcceptedRepTime >= this.config.cooldownMs
          this.cycleStart = null
          if (duration < this.config.minCycleMs || !cooledDown)
            this.move(
              "TOP_CONFIRMED",
              "Movement too fast to verify. Use a controlled pace.",
            )
          else {
            this.data.totalAcceptedReps++
            this.data.sequenceNumber++
            this.data.lastAcceptedRepTime = now
            this.move("REP_COMPLETED", "Rep accepted.")
            return result(duration)
          }
        }
        break
    }
    return result()
  }
}
