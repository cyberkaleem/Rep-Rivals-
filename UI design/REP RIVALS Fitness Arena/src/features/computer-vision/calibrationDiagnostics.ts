import { alignment, jointIssue, JOINT_NAMES, POSE_RULES, SIDES } from "./geometry"
import { COUNTER_CONFIG } from "./pushUpCounter"
import type { Landmark, TrackingSide } from "./types"

export function reading(value: number | null | undefined, digits = 3) {
  return Number.isFinite(value) ? value!.toFixed(digits) : "—"
}

export function sideDiagnostics(points: Landmark[], side: TrackingSide, width: number, height: number,
  previousHip?: { x: number; y: number }) {
  const joints = SIDES[side].map((id, index) => ({
    name: JOINT_NAMES[index], point: points[id], issue: jointIssue(points[id]),
  }))
  const hip = joints[3].point
  const hipDelta = previousHip && hip
    ? Math.hypot((hip.x - previousHip.x) * width, (hip.y - previousHip.y) * height) : null
  const a = alignment(points, side, width, height)
  const blocked = joints.filter(j => j.issue)
  let gate = "Meets raw start gates"
  if (!points.length) gate = "No landmarks"
  else if (blocked.length) gate = blocked.map(j => {
    if (j.issue === "low visibility") return `${j.name} visibility ${reading(j.point.visibility)} < ${POSE_RULES.visibility}`
    if (j.issue === "outside margin") return `${j.name} outside margin (${reading(j.point.x)}, ${reading(j.point.y)})`
    return `${j.name} ${j.issue}`
  }).join(", ")
  else if (a.hip === null || a.elbow === null || a.knee === null) gate = "Degenerate joint angle"
  else if (a.span < POSE_RULES.minBodySpan) gate = `Shoulder-to-ankle width ${reading(a.span * width, 1)} px < ${reading(POSE_RULES.minBodySpan * width, 1)} px`
  else if (a.slope > POSE_RULES.maxBodySlope) gate = `Slope ${reading(a.slope)} > ${POSE_RULES.maxBodySlope}`
  else if (a.wristDrop < POSE_RULES.minWristDrop) gate = `Wrist drop ${reading(a.wristDrop)} < ${POSE_RULES.minWristDrop}`
  else if (a.hip < POSE_RULES.minAlignment) gate = `Hip angle ${reading(a.hip, 2)}° < ${POSE_RULES.minAlignment}°`
  else if (a.knee < POSE_RULES.minAlignment) gate = `Knee angle ${reading(a.knee, 2)}° < ${POSE_RULES.minAlignment}°`
  else if (a.elbow < COUNTER_CONFIG.topAngle) gate = `Elbow angle ${reading(a.elbow, 2)}° < ${COUNTER_CONFIG.topAngle}°`
  return { side, joints, hipDelta, angles: a, gate }
}
