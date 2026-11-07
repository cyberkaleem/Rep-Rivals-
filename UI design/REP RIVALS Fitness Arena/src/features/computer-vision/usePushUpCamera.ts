import { useCallback, useEffect, useRef, useState } from "react"
import { CameraSession, type CameraFrame, type ModelFailure } from "./cameraSession"
import { drawOverlay } from "./overlay"
import { PoseTracker, type TrackingSnapshot } from "./poseTracker"
import type { AcceptedRep } from "./types"
import { AutoStartCountdown } from "../solo-training/autoStartCountdown"
import { Capacitor } from "@capacitor/core"
import { reading, sideDiagnostics } from "./calibrationDiagnostics"
import { SIDES } from "./geometry"
import { COUNTER_CONFIG } from "./pushUpCounter"

const initialSnapshot = (): TrackingSnapshot => new PoseTracker("").snapshot()
interface InferenceSample extends Omit<CameraFrame, "points"> {
  rejection: string | null
  canvasWidth: number
  canvasHeight: number
  previewWidth: number
  previewHeight: number
  screenAngle: number | null
  facing: string
  sides: ReturnType<typeof sideDiagnostics>[]
  lastInterruption: string | null
  holdStatus: string | null
}
export function usePushUpCamera(onRep?: (rep: AcceptedRep) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const camera = useRef<CameraSession | null>(null)
  const tracker = useRef<PoseTracker | null>(null)
  const repCallback = useRef(onRep)
  repCallback.current = onRep
  const showOverlay = useRef(true)
  const startedAt = useRef<number | null>(null)
  const autoStartEnabled = useRef(false)
  const [countdown] = useState(() => new AutoStartCountdown())
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [status, setStatus] = useState("Camera off")
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(false)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [inferenceMs, setInferenceMs] = useState(0)
  const [diagnostics, setDiagnostics] = useState<InferenceSample | null>(null)
  const [modelFailure, setModelFailure] = useState<ModelFailure | null>(null)

  const cancelCountdown = useCallback(() => {
    countdown.reset()
    setCountdownSeconds(null)
  }, [countdown])

  const stop = useCallback((message = "Session ended. Camera off.") => {
    cancelCountdown()
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
  }, [cancelCountdown])

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
      countdown.reset()
      camera.current?.stop()
      camera.current = null
      document.removeEventListener("visibilitychange", hide)
      window.removeEventListener("pagehide", leave)
    }
  }, [stop, countdown])
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      if (startedAt.current !== null)
        setElapsedMs(performance.now() - startedAt.current)
    }, 200)
    return () => window.clearInterval(id)
  }, [running])

  const start = () => {
    const current = tracker.current
    const pose = current?.counter.snapshot()
    if (!camera.current || !current || document.hidden || startedAt.current !== null ||
        !pose?.calibrated || pose.state !== "TOP_CONFIRMED") return

    startedAt.current = performance.now()
    current.counter.setCounting(true)
    cancelCountdown()
    setRunning(true)
    setElapsedMs(0)
  }

  const enable = () => {
    if (!videoRef.current || camera.current) return
    const current = new PoseTracker(crypto.randomUUID(), Capacitor.getPlatform() === "android")
    tracker.current = current
    setSnapshot(current.snapshot())
    setFinished(false)
    setElapsedMs(0)
    setError(null)
    setDiagnostics(null)
    setModelFailure(null)
    setActive(true)
    let lastUi = -Infinity
    let lastSample = -Infinity
    let previousHips: ({ x: number; y: number } | undefined)[] = []
    let previousTime = -Infinity, previousWidth = 0, previousHeight = 0
    let previousProgress = 0
    let lastInterruption: string | null = null
    const session = new CameraSession(videoRef.current, {
      onStatus: setStatus,
      onError: (message, failure) => {
        if (failure) setModelFailure(failure)
        stop("Camera off")
        setError(message)
      },
      onFrame: ({ points, ...frame }) => {
        const { width, height, timestampMs: now, inference } = frame
        const update = current.update(points, width, height, now)
        const readyForAutoStart = autoStartEnabled.current && startedAt.current === null &&
          !document.hidden && inference !== null && update.rejection === null &&
          update.snapshot.calibrated && update.snapshot.state === "TOP_CONFIRMED"
        const remaining = countdown.update(now, readyForAutoStart)
        if (remaining === 0) start()
        else setCountdownSeconds(remaining)
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
          setInferenceMs(inference?.ms ?? 0)
          lastUi = now
        }
        const progress = update.snapshot.calibrationProgress
        const interrupted = startedAt.current === null && previousProgress > 0 &&
          (progress < previousProgress || (!!current.hold?.paused && previousProgress === progress))
        if (now - lastSample >= 300 || interrupted) {
          const video = videoRef.current!
          const canvas = canvasRef.current!
          const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0]
          let rejection = update.rejection
          if (!inference) rejection = "Waiting for a fresh decoded frame."
          else if (inference.poses === 0) rejection = "MediaPipe returned zero poses."
          else if (inference.landmarks === 0) rejection = "Pose contains no landmarks."
          const comparable = now - previousTime <= COUNTER_CONFIG.maxFrameGapMs &&
            width === previousWidth && height === previousHeight
          const sides = (["left", "right"] as const).map((side, i) =>
            sideDiagnostics(points, side, width, height, comparable ? previousHips[i] : undefined))
          const selected = sides.find(s => s.side === update.snapshot.selectedTrackingSide)
          if (interrupted) {
            let reason = selected?.gate ?? sides.map(s => s.side + " " + s.gate).join(" / ")
            if (!inference || !inference.poses) reason = rejection ?? "No landmarks"
            else if (now - previousTime > COUNTER_CONFIG.maxFrameGapMs) reason = `Frame gap ${Math.round(now - previousTime)} ms`
            else if (width !== previousWidth || height !== previousHeight) reason = "Input dimensions changed"
            const hip = selected?.joints[3].point
            const detail = hip && selected ? ` · ${selected.side} hip V ${reading(hip.visibility)}, P ${reading(hip.presence)}, Δ ${reading(selected.hipDelta, 1)} px` : ""
            lastInterruption = `${Math.round(previousProgress * 100)}% · ${reason}${detail} · ${current.hold?.paused ? "paused" : "reset"}`
          }
          setDiagnostics({
            ...frame, rejection,
            sides, lastInterruption,
            holdStatus: current.hold && startedAt.current === null
              ? `${current.hold.observations} valid frames · ${Math.round(current.hold.validMs)} ms${current.hold.paused ? " · paused" : ""}` : null,
            canvasWidth: canvas.width, canvasHeight: canvas.height,
            previewWidth: video.clientWidth, previewHeight: video.clientHeight,
            screenAngle: window.screen.orientation?.angle ?? null,
            facing: track?.getSettings().facingMode ?? "unspecified",
          })
          lastSample = now
        }
        previousProgress = progress
        previousTime = now
        previousWidth = width
        previousHeight = height
        previousHips = [points[SIDES.left[3]], points[SIDES.right[3]]].map(p => p && { x: p.x, y: p.y })
        if (update.rep) repCallback.current?.(update.rep)
      },
    })
    camera.current = session
    void session.start()
  }
  const recalibrate = () => {
    cancelCountdown()
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
    diagnostics,
    modelFailure,
    countdownSeconds,
    setAutoStart: (enabled: boolean) => {
      autoStartEnabled.current = enabled
      if (!enabled) cancelCountdown()
    },
    enable,
    start,
    stop,
    recalibrate,
    setOverlay: (value: boolean) => {
      showOverlay.current = value
    },
  }
}
