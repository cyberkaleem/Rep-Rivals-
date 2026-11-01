import { useCallback, useEffect, useRef, useState } from "react"
import { CameraSession } from "./cameraSession"
import { drawOverlay } from "./overlay"
import { PoseTracker, type TrackingSnapshot } from "./poseTracker"
import type { AcceptedRep } from "./types"

const initialSnapshot = (): TrackingSnapshot => new PoseTracker("").snapshot()
export function usePushUpCamera(onRep?: (rep: AcceptedRep) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const camera = useRef<CameraSession | null>(null)
  const tracker = useRef<PoseTracker | null>(null)
  const repCallback = useRef(onRep)
  repCallback.current = onRep
  const showOverlay = useRef(true)
  const startedAt = useRef<number | null>(null)
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [status, setStatus] = useState("Camera off")
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(false)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [inferenceMs, setInferenceMs] = useState(0)

  const stop = useCallback((message = "Session ended. Camera off.") => {
    camera.current?.stop()
    camera.current = null
    tracker.current?.counter.setCounting(false)
    if (startedAt.current !== null) {
      setElapsedMs(performance.now() - startedAt.current)
      setFinished(true)
    }
    startedAt.current = null
    setActive(false)
    setRunning(false)
    setStatus(message)
    const canvas = canvasRef.current
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  useEffect(() => {
    const hide = () => {
      if (document.hidden && camera.current)
        stop(
          "Session stopped because the page was hidden. Start a new session to continue.",
        )
    }
    const leave = () => stop("Camera off")
    document.addEventListener("visibilitychange", hide)
    window.addEventListener("pagehide", leave)
    return () => {
      camera.current?.stop()
      camera.current = null
      document.removeEventListener("visibilitychange", hide)
      window.removeEventListener("pagehide", leave)
    }
  }, [stop])
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      if (startedAt.current !== null)
        setElapsedMs(performance.now() - startedAt.current)
    }, 200)
    return () => window.clearInterval(id)
  }, [running])

  const enable = () => {
    if (!videoRef.current || camera.current) return
    const current = new PoseTracker(crypto.randomUUID())
    tracker.current = current
    setSnapshot(current.snapshot())
    setFinished(false)
    setElapsedMs(0)
    setError(null)
    setActive(true)
    let lastUi = -Infinity
    const session = new CameraSession(videoRef.current, {
      onStatus: setStatus,
      onError: (message) => {
        stop("Camera off")
        setError(message)
      },
      onFrame: (points, width, height, now, cost) => {
        const update = current.update(points, width, height, now)
        if (canvasRef.current)
          drawOverlay(
            canvasRef.current,
            showOverlay.current ? points : [],
            width,
            height,
            update.snapshot.selectedTrackingSide,
          )
        if (now - lastUi >= 100 || update.rep) {
          setSnapshot(update.snapshot)
          setInferenceMs(cost)
          lastUi = now
        }
        if (update.rep) repCallback.current?.(update.rep)
      },
    })
    camera.current = session
    void session.start()
  }
  const start = () => {
    if (
      !camera.current ||
      !tracker.current?.counter.snapshot().calibrated ||
      tracker.current.counter.snapshot().state !== "TOP_CONFIRMED" ||
      startedAt.current !== null
    )
      return
    tracker.current.counter.setCounting(true)
    startedAt.current = performance.now()
    setRunning(true)
    setElapsedMs(0)
  }
  const recalibrate = () => {
    tracker.current?.recalibrate()
    if (tracker.current) setSnapshot(tracker.current.snapshot())
  }
  return {
    videoRef,
    canvasRef,
    snapshot,
    status,
    error,
    active,
    running,
    finished,
    elapsedMs,
    inferenceMs,
    enable,
    start,
    stop,
    recalibrate,
    setOverlay: (value: boolean) => {
      showOverlay.current = value
    },
  }
}
