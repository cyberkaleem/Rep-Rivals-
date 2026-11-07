import type { Landmark } from "./types"
import { Capacitor } from "@capacitor/core"

export type Delegate = "CPU" | "GPU"
export type ModelFailure = "Initialization failed" | "Inference failed"
export interface Detector {
  delegate: Delegate
  runningMode: "VIDEO"
  detectForVideo(video: HTMLVideoElement, timestampMs: number): {
    landmarks: Landmark[][]
  }
  close(): void
}
export interface CameraFrame {
  points: Landmark[]
  width: number
  height: number
  timestampMs: number
  mediaTimeMs: number
  delegate: Delegate
  runningMode: "VIDEO"
  count: number
  fps: number | null
  // A stale camera tick invalidates tracking but carries no model result.
  inference: { ms: number; poses: number; landmarks: number } | null
}
export interface CameraCallbacks {
  onFrame: (frame: CameraFrame) => void
  onStatus: (status: string) => void
  onError: (message: string, modelFailure?: ModelFailure) => void
}
export function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera permission denied. Allow camera access in your browser site settings, then retry."
  if (name === "NotFoundError")
    return "No camera found. Connect a camera and retry."
  if (name === "NotReadableError" || name === "AbortError")
    return "Camera unavailable. Close other apps using it and retry."
  if (name === "OverconstrainedError")
    return "This camera cannot use the requested video settings. Try another camera."
  return "Camera or pose model could not start. Check the camera and local vision assets, then retry."
}

/** Owns all browser resources; stopping also cancels in-flight initialization. */
export class CameraSession {
  private started = false
  private stopped = false
  private stream: MediaStream | null = null
  private detector: Detector | null = null
  private raf = 0
  private lastVideoTime = -1
  private presentationCallback: number | null = null
  private presentedTime = -1
  private lastInference = -Infinity
  private lastFreshFrame = 0
  private count = 0
  private rateStart = 0
  private rateStartCount = 0
  private fps: number | null = null
  private listeners: Array<() => void> = []
  constructor(
    private video: HTMLVideoElement,
    private callbacks: CameraCallbacks,
    private loadDetector: () => Promise<Detector> = async () =>
      (await import("./landmarker")).createLandmarker(),
    private readonly watchPresentedFrames = Capacitor.getPlatform() === "android",
  ) {}

  async start() {
    if (this.started || this.stopped) return
    this.started = true
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        this.fail(
          "Camera access requires HTTPS or localhost and a supported browser.",
        )
        return
      }
      this.callbacks.onStatus("Waiting for camera permission…")
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
      })
      if (this.stopped) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      this.stream = stream
      this.video.srcObject = stream
      for (const track of stream.getVideoTracks()) {
        const ended = () =>
          this.fail(
            "Camera disconnected. Reconnect it and start a new session.",
          )
        track.addEventListener("ended", ended)
        this.listeners.push(() => track.removeEventListener("ended", ended))
      }
      await this.video.play()
      if (this.stopped) return
      this.callbacks.onStatus("Loading pose tracking…")
      let detector: Detector
      try {
        detector = await this.loadDetector()
      } catch {
        if (!this.stopped) this.fail("Pose model could not start. Check the local vision assets and retry.", "Initialization failed")
        return
      }
      if (this.stopped) {
        detector.close()
        return
      }
      this.detector = detector
      if (this.watchPresentedFrames && typeof this.video.requestVideoFrameCallback === "function") {
        const presented: VideoFrameRequestCallback = (_now, metadata) => {
          if (this.stopped) return
          this.presentedTime = metadata.mediaTime
          this.presentationCallback = this.video.requestVideoFrameCallback(presented)
        }
        this.presentationCallback = this.video.requestVideoFrameCallback(presented)
      }
      this.callbacks.onStatus("Camera active · tracking locally")
      this.lastFreshFrame = performance.now()
      this.rateStart = this.lastFreshFrame
      this.raf = requestAnimationFrame(this.frame)
    } catch (error) {
      if (!this.stopped) this.fail(cameraError(error))
    }
  }
  private frame = (now: number) => {
    if (this.stopped) return
    try {
      // Cap inference at 20 Hz; skip repeated decoded frames. No video or landmarks leave this device.
      const videoTime = this.presentationCallback === null ? this.video.currentTime : this.presentedTime
      const fresh = this.presentationCallback === null ? videoTime !== this.lastVideoTime : videoTime > this.lastVideoTime
      if (
        now - this.lastInference >= 50 &&
        this.video.readyState >= 2 &&
        fresh
      ) {
        this.lastVideoTime = videoTime
        this.lastInference = now
        this.lastFreshFrame = now
        const started = performance.now()
        let result: ReturnType<Detector["detectForVideo"]>
        try {
          result = this.detector!.detectForVideo(this.video, now)
        } catch {
          this.fail("Pose inference failed. Restart the camera to retry.", "Inference failed")
          return
        }
        const ms = performance.now() - started
        this.count++
        if (now - this.rateStart >= 1000) {
          this.fps = (this.count - this.rateStartCount) * 1000 / (now - this.rateStart)
          this.rateStart = now
          this.rateStartCount = this.count
        }
        this.emit(now, result.landmarks[0] ?? [], {
          ms, poses: result.landmarks.length,
          landmarks: result.landmarks.reduce((total, pose) => total + pose.length, 0),
        })
      } else if (
        now - this.lastFreshFrame > 400 &&
        now - this.lastInference >= 50
      ) {
        this.lastInference = now
        this.emit(now, [], null)
      }
      if (!this.stopped) this.raf = requestAnimationFrame(this.frame)
    } catch {
      this.fail(
        "Pose tracking stopped unexpectedly. Stop and restart the camera to retry.",
      )
    }
  }
  private emit(timestampMs: number, points: Landmark[], inference: CameraFrame["inference"]) {
    const detector = this.detector!
    this.callbacks.onFrame({
      points, inference, timestampMs, count: this.count, fps: inference ? this.fps : 0,
      delegate: detector.delegate, runningMode: detector.runningMode,
      width: this.video.videoWidth, height: this.video.videoHeight,
      mediaTimeMs: Math.max(0, this.lastVideoTime) * 1000,
    })
  }
  private fail(message: string, modelFailure?: ModelFailure) {
    this.stop()
    if (modelFailure) this.callbacks.onError(message, modelFailure)
    else this.callbacks.onError(message)
  }
  stop() {
    if (this.stopped) return
    this.stopped = true
    cancelAnimationFrame(this.raf)
    if (this.presentationCallback !== null) this.video.cancelVideoFrameCallback(this.presentationCallback)
    this.listeners.forEach((remove) => remove())
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.video.pause()
    this.video.srcObject = null
    this.detector?.close()
    this.detector = null
  }
}
