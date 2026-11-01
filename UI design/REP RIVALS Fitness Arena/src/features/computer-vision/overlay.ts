import type { Landmark, TrackingSide } from "./types"
import { SIDES } from "./geometry"

export function drawOverlay(
  canvas: HTMLCanvasElement,
  points: Landmark[],
  width: number,
  height: number,
  selected: TrackingSide | null,
) {
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  for (const side of ["left", "right"] as const) {
    const [s, e, w, h, k, a] = SIDES[side]
    ctx.strokeStyle = ctx.fillStyle = side === selected ? "#ff7a45" : "#b8bec5"
    ctx.lineWidth = 3
    const visible = (i: number) =>
      points[i] && (points[i].visibility ?? 0) >= 0.6
    for (const [from, to] of [
      [s, e],
      [e, w],
      [s, h],
      [h, k],
      [k, a],
    ]) {
      if (!visible(from) || !visible(to)) continue
      ctx.beginPath()
      ctx.moveTo(points[from].x * width, points[from].y * height)
      ctx.lineTo(points[to].x * width, points[to].y * height)
      ctx.stroke()
    }
    for (const i of SIDES[side]) {
      if (!visible(i)) continue
      ctx.beginPath()
      ctx.arc(points[i].x * width, points[i].y * height, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}
