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
      return p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        Number.isFinite(p.visibility) &&
        p.x >= POSE_RULES.margin &&
        p.x <= 1 - POSE_RULES.margin &&
        p.y >= POSE_RULES.margin &&
        p.y <= 1 - POSE_RULES.margin
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

export function extractFeatures(
  points: Landmark[],
  side: TrackingSide,
  width: number,
  height: number,
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
  const [shoulder, elbow, wrist, hip, knee, ankle] = SIDES[side].map(
    (i) => points[i],
  )
  const angle = jointAngle(shoulder, elbow, wrist, width, height)
  const hipAngle = jointAngle(shoulder, hip, ankle, width, height)
  const kneeAngle = jointAngle(hip, knee, ankle, width, height)
  if (angle === null || hipAngle === null || kneeAngle === null)
    return invalid("Unable to verify position. Adjust camera position.")
  const dx = Math.abs(shoulder.x - ankle.x) * width
  const dy = Math.abs(shoulder.y - ankle.y) * height
  if (
    dx < width * POSE_RULES.minBodySpan ||
    dy > dx * POSE_RULES.maxBodySlope ||
    wrist.y < shoulder.y + 0.025
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
