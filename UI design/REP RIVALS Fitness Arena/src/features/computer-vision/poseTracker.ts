import { extractFeatures, selectSide } from "./geometry"
import { COUNTER_CONFIG, PushUpCounter } from "./pushUpCounter"
import type {
  AcceptedRep,
  CounterSnapshot,
  Landmark,
  TrackingSide,
} from "./types"

export interface TrackingSnapshot extends CounterSnapshot {
  selectedTrackingSide: TrackingSide | null
  landmarkQuality: number
}

interface TrackingUpdate {
  snapshot: TrackingSnapshot
  rep: AcceptedRep | null
}

export class PoseTracker {
  readonly counter = new PushUpCounter()
  private side: TrackingSide | null = null
  private lostSince: number | null = null
  private lastTimestamp = -Infinity
  constructor(readonly sessionId: string) {}
  snapshot(): TrackingSnapshot {
    return {
      ...this.counter.snapshot(),
      selectedTrackingSide: this.side,
      landmarkQuality: 0,
    }
  }
  recalibrate() {
    this.side = null
    this.lostSince = null
    this.counter.recalibrate()
  }
  update(
    points: Landmark[],
    width: number,
    height: number,
    timestampMs: number,
  ): TrackingUpdate {
    if (!Number.isFinite(timestampMs) || timestampMs <= this.lastTimestamp)
      return { snapshot: this.snapshot(), rep: null }
    if (
      timestampMs - this.lastTimestamp >= COUNTER_CONFIG.recalibrateAfterMs &&
      Number.isFinite(this.lastTimestamp)
    )
      this.recalibrate()
    this.lastTimestamp = timestampMs
    this.side ??= selectSide(points)
    const features = this.side
      ? extractFeatures(points, this.side, width, height)
      : {
          valid: false,
          elbowAngle: null,
          quality: 0,
          feedback:
            "Move back until your full body is visible. Turn sideways for improved tracking.",
        }
    if (features.valid) this.lostSince = null
    else {
      this.lostSince ??= timestampMs
      if (timestampMs - this.lostSince >= COUNTER_CONFIG.recalibrateAfterMs)
        this.recalibrate()
    }
    const { snapshot, cycleDurationMs } = this.counter.update({
      timestampMs,
      ...features,
    })
    const rep: AcceptedRep | null =
      cycleDurationMs !== null && this.side
        ? {
            sessionId: this.sessionId,
            exerciseType: "push-ups",
            source: "camera",
            sequenceNumber: snapshot.sequenceNumber,
            totalAcceptedReps: snapshot.totalAcceptedReps,
            timestampMs,
            cycleDurationMs,
            landmarkQuality: features.quality,
            selectedTrackingSide: this.side,
          }
        : null
    return {
      snapshot: {
        ...snapshot,
        selectedTrackingSide: this.side,
        landmarkQuality: features.quality,
      },
      rep,
    }
  }
}
