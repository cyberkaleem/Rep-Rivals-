import type { Landmark, PoseFeatures, TrackingSide } from "./types"

export const SIDES = {
  left: [11, 13, 15, 23, 25, 27],
  right: [12, 14, 16, 24, 26, 28],
} as const
export const POSE_RULES = {
  visibility: 0.6,
  margin: 0.015,
  minAlignment: 150,
  maxBodySlope: 0.65,
  minBodySpan: 0.25,
  minWristDrop: 0.025,
}
export const JOINT_NAMES = ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"] as const

export function inFrame(p: Landmark | undefined): p is Landmark {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.x >= POSE_RULES.margin && p.x <= 1 - POSE_RULES.margin &&
    p.y >= POSE_RULES.margin && p.y <= 1 - POSE_RULES.margin
}

export function jointIssue(p: Landmark | undefined) {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return "missing coordinates"
  if (!inFrame(p)) return "outside margin"
  if (!Number.isFinite(p.visibility)) return "missing visibility"
  return p.visibility! < POSE_RULES.visibility ? "low visibility" : null
}

/** Pixel-equivalent coordinates prevent aspect-ratio distortion of joint angles. */
export function jointAngle(
  a: Landmark,
  b: Landmark,
  c: Landmark,
  width: number,
  height: number,
): number | null {
  if (
    ![a.x, a.y, b.x, b.y, c.x, c.y, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  )
    return null
  const u = [(a.x - b.x) * width, (a.y - b.y) * height]
  const v = [(c.x - b.x) * width, (c.y - b.y) * height]
  const length = Math.hypot(...u) * Math.hypot(...v)
  if (length < 1e-6) return null
  return (
    (Math.acos(
      Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / length)),
    ) *
      180) /
    Math.PI
  )
}

export function sideQuality(points: Landmark[], side: TrackingSide): number {
  return Math.min(
    ...SIDES[side].map((i) => {
      const p = points[i]
      return inFrame(p) && Number.isFinite(p.visibility)
        ? Math.max(0, Math.min(1, p.visibility!))
        : 0
    }),
  )
}

export function selectSide(points: Landmark[]): TrackingSide | null {
  const left = sideQuality(points, "left"),
    right = sideQuality(points, "right")
  if (Math.max(left, right) < POSE_RULES.visibility) return null
  return left >= right ? "left" : "right"
}

export function alignment(points: Landmark[], side: TrackingSide, width: number, height: number) {
  const [s, e, w, h, k, a] = SIDES[side].map(i => points[i])
  const angle = (p: Landmark, q: Landmark, r: Landmark) =>
    p && q && r ? jointAngle(p, q, r, width, height) : null
  const dx = s && a ? Math.abs(s.x - a.x) * width : NaN
  return {
    elbow: angle(s, e, w), hip: angle(s, h, a), knee: angle(h, k, a),
    span: dx / width, slope: s && a ? Math.abs(s.y - a.y) * height / dx : NaN,
    wristDrop: s && w ? w.y - s.y : NaN,
  }
}

export function extractFeatures(
  points: Landmark[],
  side: TrackingSide,
  width: number,
  height: number,
  angles = alignment(points, side, width, height),
): PoseFeatures {
  const quality = sideQuality(points, side)
  const invalid = (feedback: string): PoseFeatures => ({
    valid: false,
    elbowAngle: null,
    quality,
    feedback,
  })
  if (quality < POSE_RULES.visibility)
    return invalid(
      "Keep your full body visible. Improve lighting or adjust the camera.",
    )
  const { elbow: angle, hip: hipAngle, knee: kneeAngle } = angles
  if (angle === null || hipAngle === null || kneeAngle === null)
    return invalid("Unable to verify position. Adjust camera position.")
  if (
    angles.span < POSE_RULES.minBodySpan ||
    angles.slope > POSE_RULES.maxBodySlope ||
    angles.wristDrop < POSE_RULES.minWristDrop
  ) {
    return invalid(
      "Turn sideways and hold a push-up plank with your full body in view.",
    )
  }
  if (hipAngle < POSE_RULES.minAlignment || kneeAngle < POSE_RULES.minAlignment)
    return invalid(
      "Keep shoulders, hips and legs in line. Unable to verify this position.",
    )
  return {
    valid: true,
    elbowAngle: angle,
    quality,
    feedback: "Position visible.",
  }
}
