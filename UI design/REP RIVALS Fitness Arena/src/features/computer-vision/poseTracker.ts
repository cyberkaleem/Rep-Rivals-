import { alignment, extractFeatures, POSE_RULES, selectSide } from "./geometry"
import { AndroidCalibration, startingSide } from "./androidCalibration"
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
  rejection: string | null
}

export class PoseTracker {
  readonly counter = new PushUpCounter()
  private side: TrackingSide | null = null
  private lostSince: number | null = null
  private lastTimestamp = -Infinity
  private width = 0
  private height = 0
  readonly hold: AndroidCalibration | null
  constructor(readonly sessionId: string, androidPreview = false) {
    this.hold = androidPreview ? new AndroidCalibration() : null
  }
  snapshot(): TrackingSnapshot {
    return {
      ...this.counter.snapshot(),
      selectedTrackingSide: this.side,
      landmarkQuality: 0,
    }
  }
  recalibrate() {
    this.hold?.reset()
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
      return { snapshot: this.snapshot(), rep: null, rejection: "Invalid or repeated timestamp." }
    if (
      timestampMs - this.lastTimestamp >= COUNTER_CONFIG.recalibrateAfterMs &&
      Number.isFinite(this.lastTimestamp)
    )
      this.recalibrate()
    this.lastTimestamp = timestampMs
    const hold = this.counter.isCounting ? null : this.hold
    if (hold && (width !== this.width || height !== this.height)) this.recalibrate()
    this.width = width
    this.height = height
    if (hold && hold.observations === 0) {
      this.side = startingSide(points, selectSide(points), width, height, this.side)
    } else {
      this.side ??= selectSide(points)
    }
    const angles = this.side ? alignment(points, this.side, width, height) : null
    const features = this.side
      ? extractFeatures(points, this.side, width, height, angles!)
      : {
          valid: false,
          elbowAngle: null,
          quality: 0,
          feedback:
            "Move back until your full body is visible. Turn sideways for improved tracking.",
        }
    if (hold && angles && !features.valid && features.quality >= POSE_RULES.visibility &&
        angles.span < POSE_RULES.minBodySpan) {
      const spanPx = (angles.span * width).toFixed(1)
      const requiredPx = (POSE_RULES.minBodySpan * width).toFixed(1)
      features.feedback = `Check the side view and keep your whole body in frame. Shoulder-to-ankle width is ${spanPx} px of the required ${requiredPx} px.`
    }
    const rejection = features.valid ? null : this.side ? features.feedback
      : "Neither side has six in-frame joints above the visibility threshold."
    if (features.valid) this.lostSince = null
    else {
      this.lostSince ??= timestampMs
      if (timestampMs - this.lostSince >= COUNTER_CONFIG.recalibrateAfterMs)
        this.recalibrate()
    }
    const { snapshot, cycleDurationMs } = this.counter.update({
      timestampMs,
      ...features,
      previewProgress: hold?.update(points, this.side, width, height, timestampMs, angles, features.valid),
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
      rejection,
    }
  }
}
