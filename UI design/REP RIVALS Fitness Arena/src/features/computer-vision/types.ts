export type TrackingSide = "left" | "right"
export type MovementState = "NOT_READY" | "TOP_CONFIRMED" | "DESCENDING" | "BOTTOM_CONFIRMED" | "ASCENDING" | "REP_COMPLETED" | "TRACKING_LOST"
export interface Landmark {
  x: number
  y: number
  z?: number
  visibility?: number
  presence?: number
}
export interface PoseFeatures {
  valid: boolean
  elbowAngle: number | null
  quality: number
  feedback: string
}
/** Local CV evidence only. A future server must validate and acknowledge official reps. */
export interface AcceptedRep {
  sessionId: string
  exerciseType: "push-ups"
  source: "camera"
  sequenceNumber: number
  totalAcceptedReps: number
  timestampMs: number
  cycleDurationMs: number
  landmarkQuality: number
  selectedTrackingSide: TrackingSide
}
export interface CounterSnapshot {
  totalAcceptedReps: number
  sequenceNumber: number
  state: MovementState
  calibrated: boolean
  calibrationProgress: number
  angle: number | null
  lastAcceptedRepTime: number | null
  feedback: string
}
