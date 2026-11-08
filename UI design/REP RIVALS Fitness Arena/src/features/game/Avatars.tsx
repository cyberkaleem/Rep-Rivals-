import { useEffect, useRef, useState } from "react"
import * as T from "three"
import type { Outfit } from "./connection"

type Pose = "idle" | "ready" | "plank" | "win" | "loss" | "draw"
export interface Athlete {
  id: string
  outfit: Outfit
  score: number
  pose: Pose
}
const colors = { ember: 0xff641c, tide: 0x22c5d5, violet: 0xab78ff }

function model(scene: T.Scene, x: number, side: number) {
  const root = new T.Group()
  scene.add(root)
  const fabric = new T.MeshStandardMaterial({ roughness: 0.85 })
  const dark = new T.MeshStandardMaterial({ color: 0x27303c }),
    skin = new T.MeshStandardMaterial({ color: side ? 0xa8694a : 0xcd9065 })
  const trim = new T.MeshStandardMaterial({ color: 0xf5e7ce }),
    hair = new T.MeshStandardMaterial({ color: 0x352520 })
  function part(
    parent: T.Object3D,
    geo: T.BufferGeometry,
    mat: T.Material,
    a: number,
    b: number,
    c: number,
  ) {
    const mesh = new T.Mesh(geo, mat)
    mesh.position.set(a, b, c)
    parent.add(mesh)
    return mesh
  }
  function joint(parent: T.Object3D, a: number, b: number, c: number) {
    const j = new T.Group()
    j.position.set(a, b, c)
    parent.add(j)
    return j
  }
  function limb(
    parent: T.Object3D,
    length: number,
    width: number,
    mat: T.Material,
  ) {
    return part(
      parent,
      new T.CapsuleGeometry(width, length - 2 * width, 2, 8),
      mat,
      0,
      -length / 2,
      0,
    )
  }
  const torso = part(
    root,
    new T.CylinderGeometry(0.32, 0.22, 0.55, 8),
    fabric,
    0,
    0.3,
    0,
  )
  torso.scale.z = 0.72
  part(root, new T.BoxGeometry(0.43, 0.2, 0.28), dark, 0, -0.04, 0)
  part(root, new T.CylinderGeometry(0.09, 0.1, 0.13, 8), skin, 0, 0.62, 0)
  const head = part(
    root,
    new T.SphereGeometry(0.188, 10, 8),
    skin,
    0,
    0.8,
    0.01,
  )
  head.scale.y = 1.14
  part(
    root,
    new T.SphereGeometry(0.192, 10, 6, 0, Math.PI * 2, 0, 1.25),
    hair,
    0,
    0.85,
    0.005,
  )
  part(root, new T.BoxGeometry(0.26, 0.045, 0.1), trim, 0, 0.84, 0.135)
  const shoulders: T.Group[] = [],
    elbows: T.Group[] = []
  for (const sign of [-1, 1]) {
    const arm = joint(root, sign * 0.3, 0.51, 0)
    shoulders.push(arm)
    limb(arm, 0.32, 0.091, fabric)
    const elbow = joint(arm, 0, -0.32, 0)
    elbows.push(elbow)
    limb(elbow, 0.32, 0.067, skin)
    part(elbow, new T.BoxGeometry(0.13, 0.1, 0.16), dark, 0, -0.32, 0.025)
    const hip = joint(root, sign * 0.129, -0.1, 0)
    limb(hip, 0.43, 0.118, dark)
    limb(joint(hip, 0, -0.42, 0), 0.42, 0.079, skin)
    part(hip, new T.BoxGeometry(0.17, 0.12, 0.26), trim, 0, -0.85, 0.045)
  }
  root.position.x = x
  let lastScore: number | undefined,
    stroke = -10
  return (a: Athlete, t: number) => {
    if (lastScore !== undefined && a.score > lastScore) stroke = t
    lastScore = a.score
    fabric.color.setHex(colors[a.outfit])
    const plank = a.pose === "plank",
      win = a.pose === "win",
      low = a.pose === "loss"
    const press =
      t - stroke < 0.85 ? Math.sin(((t - stroke) / 0.85) * Math.PI) : 0
    root.rotation.set(
      plank ? 1.3 + 0.1 * press : low ? 0.2 : 0,
      plank ? (side ? -0.55 : 0.55) : side ? -0.2 : 0.2,
      0,
      "YXZ",
    )
    root.position.y = plank
      ? 0.47 - 0.19 * press
      : 1.02 +
        0.018 * Math.sin(t * 2) +
        (win ? 0.07 * Math.abs(Math.sin(t * 4)) : 0)
    shoulders.forEach((arm, i) => {
      arm.rotation.z = (i ? 1 : -1) * (win ? 2.5 : plank ? 0.18 : 0.12)
      arm.rotation.x = plank
        ? -1.6 + 0.7 * press
        : a.pose === "ready"
          ? -0.62
          : 0.1 * Math.sin(t * 2 + i)
      elbows[i].rotation.x = plank
        ? -0.22 - 1.3 * press
        : win
          ? -0.35
          : a.pose === "ready"
            ? -0.93
            : -0.18
    })
  }
}

export default function Avatars({ athletes }: { athletes: Athlete[] }) {
  const node = useRef<HTMLDivElement>(null),
    latest = useRef(athletes)
  latest.current = athletes
  const [failed, setFailed] = useState(false),
    [generation, retry] = useState(0)
  const ids = athletes.map((a) => a.id).join("/")
  useEffect(() => {
    const host = node.current
    if (!host) return
    let renderer: T.WebGLRenderer
    try {
      renderer = new T.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      })
    } catch {
      setFailed(true)
      return
    }
    setFailed(false)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    host.append(renderer.domElement)
    const scene = new T.Scene(),
      cam = new T.PerspectiveCamera(32, 1, 0.1, 30)
    cam.position.set(1.7, 1.9, 4.8)
    cam.lookAt(0, 0.85, 0)
    scene.add(new T.HemisphereLight(0xfff5e1, 0x8991ae, 2.1))
    const key = new T.DirectionalLight(0xffe4bb, 2.6)
    key.position.set(2, 4, 3)
    scene.add(key)
    const platform = new T.Mesh(
      new T.CylinderGeometry(1.48, 1.38, 0.1, 40),
      new T.MeshStandardMaterial({ color: 0x343d47 }),
    )
    platform.position.y = -0.09
    scene.add(platform)
    const rigs = latest.current.map((_, i, list) =>
      model(scene, list.length === 1 ? 0 : i ? 0.64 : -0.64, i),
    )
    const resize = new ResizeObserver(() => {
      const w = host.clientWidth,
        h = host.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      cam.aspect = w / h
      cam.updateProjectionMatrix()
    })
    resize.observe(host)
    let frame = 0,
      prev = -1,
      visible = true,
      lost = false
    const draw = (ms: number) => {
      frame = 0
      if (document.hidden || !visible || lost) return
      if (ms - prev > 40) {
        prev = ms
        rigs.forEach((rig, i) => {
          if (latest.current[i]) rig(latest.current[i], ms / 1000)
        })
        renderer.render(scene, cam)
      }
      frame = requestAnimationFrame(draw)
    }
    const resume = () => {
      if (!frame && !document.hidden && visible && !lost)
        frame = requestAnimationFrame(draw)
    }
    const view = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      resume()
    })
    view.observe(host)
    const contextLost = (event: Event) => {
      event.preventDefault()
      lost = true
      setFailed(true)
    }
    const restored = () => retry((v) => v + 1)
    const canvas = renderer.domElement
    canvas.addEventListener("webglcontextlost", contextLost)
    canvas.addEventListener("webglcontextrestored", restored)
    document.addEventListener("visibilitychange", resume)
    resume()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      view.disconnect()
      document.removeEventListener("visibilitychange", resume)
      canvas.removeEventListener("webglcontextlost", contextLost)
      canvas.removeEventListener("webglcontextrestored", restored)
      const materials = new Set<T.Material>()
      scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.geometry.dispose()
          materials.add(o.material)
        }
      })
      materials.forEach((m) => m.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    }
  }, [ids, generation])
  return (
    <div className="athletes" ref={node} aria-label="3D athletes">
      {failed && (
        <button onClick={() => retry((v) => v + 1)}>
          3D unavailable · Retry rendering
        </button>
      )}
    </div>
  )
}
