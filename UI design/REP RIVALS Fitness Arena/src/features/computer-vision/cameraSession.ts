import type { Landmark } from "./types"

export interface Detector {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): {
    landmarks: Landmark[][]
  }
  close(): void
}
export interface CameraCallbacks {
  onFrame: (
    landmarks: Landmark[],
    width: number,
    height: number,
    timestampMs: number,
    inferenceMs: number,
  ) => void
  onStatus: (status: string) => void
  onError: (message: string) => void
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
  private lastInference = -Infinity
  private lastFreshFrame = 0
  private listeners: Array<() => void> = []
  constructor(
    private video: HTMLVideoElement,
    private callbacks: CameraCallbacks,
    private loadDetector: () => Promise<Detector> = async () =>
      (await import("./landmarker")).createLandmarker(),
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
      const detector = await this.loadDetector()
      if (this.stopped) {
        detector.close()
        return
      }
      this.detector = detector
      this.callbacks.onStatus("Camera active · tracking locally")
      this.lastFreshFrame = performance.now()
      this.raf = requestAnimationFrame(this.frame)
    } catch (error) {
      if (!this.stopped) this.fail(cameraError(error))
    }
  }
  private frame = (now: number) => {
    if (this.stopped) return
    try {
      // Cap inference at 20 Hz; skip repeated decoded frames. No video or landmarks leave this device.
      if (
        now - this.lastInference >= 50 &&
        this.video.readyState >= 2 &&
        this.video.currentTime !== this.lastVideoTime
      ) {
        this.lastVideoTime = this.video.currentTime
        this.lastInference = now
        this.lastFreshFrame = now
        const started = performance.now()
        const result = this.detector!.detectForVideo(this.video, now)
        this.callbacks.onFrame(
          result.landmarks[0] ?? [],
          this.video.videoWidth,
          this.video.videoHeight,
          now,
          performance.now() - started,
        )
      } else if (
        now - this.lastFreshFrame > 400 &&
        now - this.lastInference >= 50
      ) {
        this.lastInference = now
        this.callbacks.onFrame(
          [],
          this.video.videoWidth,
          this.video.videoHeight,
          now,
          0,
        )
      }
      if (!this.stopped) this.raf = requestAnimationFrame(this.frame)
    } catch {
      this.fail(
        "Pose tracking stopped unexpectedly. Stop and restart the camera to retry.",
      )
    }
  }
  private fail(message: string) {
    this.stop()
    this.callbacks.onError(message)
  }
  stop() {
    if (this.stopped) return
    this.stopped = true
    cancelAnimationFrame(this.raf)
    this.listeners.forEach((remove) => remove())
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.video.pause()
    this.video.srcObject = null
    this.detector?.close()
    this.detector = null
  }
}
