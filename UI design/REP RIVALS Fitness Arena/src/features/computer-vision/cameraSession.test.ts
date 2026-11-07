import { afterEach, describe, expect, it, vi } from "vitest"
import { CameraSession, cameraError, type Detector } from "./cameraSession"

function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Deferred promise is not initialized') }
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
function setup() {
  const track = Object.assign(new EventTarget(), { stop: vi.fn() })
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream
  const getUserMedia = vi.fn().mockResolvedValue(stream)
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } })
  vi.stubGlobal("window", { isSecureContext: true })
  const raf = vi.fn().mockReturnValue(1)
  vi.stubGlobal("requestAnimationFrame", raf)
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
  const video = {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    srcObject: null,
    readyState: 4,
    currentTime: 1,
    videoWidth: 640,
    videoHeight: 480,
  } as unknown as HTMLVideoElement
  const detector = {
    delegate: "CPU" as const,
    runningMode: "VIDEO" as const,
    detectForVideo: vi.fn().mockReturnValue({ landmarks: [] }),
    close: vi.fn(),
  }
  const callbacks = { onFrame: vi.fn(), onStatus: vi.fn(), onError: vi.fn() }
  return { track, stream, getUserMedia, raf, video, detector, callbacks }
}
afterEach(() => vi.unstubAllGlobals())
describe("camera resource ownership", () => {
  it("stops a stream acquired after cancellation without loading a model", async () => {
    const s = setup(),
      pending = deferred<MediaStream>()
    s.getUserMedia.mockReturnValue(pending.promise)
    const load = vi.fn().mockResolvedValue(s.detector)
    const camera = new CameraSession(s.video, s.callbacks, load)
    const start = camera.start()
    camera.stop()
    pending.resolve(s.stream)
    await start
    expect(s.track.stop).toHaveBeenCalledOnce()
    expect(load).not.toHaveBeenCalled()
  })
  it("closes a model that finishes loading after cancellation", async () => {
    const s = setup(),
      pending = deferred<Detector>()
    const load = vi.fn().mockReturnValue(pending.promise)
    const camera = new CameraSession(s.video, s.callbacks, load),
      start = camera.start()
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce())
    camera.stop()
    pending.resolve(s.detector)
    await start
    expect(s.detector.close).toHaveBeenCalledOnce()
    expect(s.raf).not.toHaveBeenCalled()
  })
  it("prevents duplicate loops and releases resources exactly once", async () => {
    const s = setup(),
      camera = new CameraSession(s.video, s.callbacks, async () => s.detector)
    await camera.start()
    await camera.start()
    expect(s.getUserMedia).toHaveBeenCalledOnce()
    expect(s.raf).toHaveBeenCalledOnce()
    camera.stop()
    camera.stop()
    expect(s.track.stop).toHaveBeenCalledOnce()
    expect(s.detector.close).toHaveBeenCalledOnce()
    expect(s.video.srcObject).toBeNull()
  })
  it("skips repeated frames and invalidates stale tracking", async () => {
    const s = setup(),
      camera = new CameraSession(s.video, s.callbacks, async () => s.detector)
    await camera.start()
    const callback = s.raf.mock.calls[0][0] as FrameRequestCallback
    const now = performance.now()
    callback(now)
    callback(now + 100)
    callback(now + 500)
    expect(s.detector.detectForVideo).toHaveBeenCalledOnce()
    expect(s.callbacks.onFrame).toHaveBeenNthCalledWith(1, expect.objectContaining({
      count: 1, points: [], inference: { ms: expect.any(Number), poses: 0, landmarks: 0 },
    }))
    expect(s.callbacks.onFrame).toHaveBeenLastCalledWith(expect.objectContaining({
      count: 1, points: [], timestampMs: now + 500, fps: 0, inference: null,
    }))
    camera.stop()
  })
  it("reports raw landmarks even when visibility is too low for tracking", async () => {
    const s = setup()
    const points = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }))
    s.detector.detectForVideo.mockReturnValue({ landmarks: [points] })
    const camera = new CameraSession(s.video, s.callbacks, async () => s.detector)
    await camera.start()
    s.raf.mock.calls[0][0](performance.now())
    expect(s.callbacks.onFrame).toHaveBeenCalledWith(expect.objectContaining({
      points, count: 1, mediaTimeMs: 1000, width: 640, height: 480,
      inference: { ms: expect.any(Number), poses: 1, landmarks: 33 },
    }))
    camera.stop()
  })
  it("rejects a moving playback clock without a new Android presentation timestamp", async () => {
    const s = setup()
    const presented = vi.fn<(callback: VideoFrameRequestCallback) => number>().mockReturnValue(7)
    const cancel = vi.fn()
    Object.assign(s.video, { requestVideoFrameCallback: presented, cancelVideoFrameCallback: cancel })
    const camera = new CameraSession(s.video, s.callbacks, async () => s.detector, true)
    await camera.start()
    const tick = s.raf.mock.calls[0][0] as FrameRequestCallback
    const now = performance.now()
    presented.mock.calls[0][0](now, { mediaTime: 1 } as VideoFrameCallbackMetadata)
    tick(now)
    s.video.currentTime = 2
    tick(now + 500)
    expect(s.detector.detectForVideo).toHaveBeenCalledTimes(1)
    expect(s.callbacks.onFrame).toHaveBeenLastCalledWith(expect.objectContaining({ inference: null }))
    presented.mock.calls[1][0](now + 600, { mediaTime: 2 } as VideoFrameCallbackMetadata)
    tick(now + 600)
    expect(s.detector.detectForVideo).toHaveBeenCalledTimes(2)
    camera.stop()
    expect(cancel).toHaveBeenCalledWith(7)
  })
  it("distinguishes an inference error from a successful empty result", async () => {
    const s = setup()
    s.detector.detectForVideo.mockImplementation(() => { throw new Error("graph failed") })
    const camera = new CameraSession(s.video, s.callbacks, async () => s.detector)
    await camera.start()
    s.raf.mock.calls[0][0](performance.now())
    expect(s.callbacks.onFrame).not.toHaveBeenCalled()
    expect(s.callbacks.onError).toHaveBeenCalledWith(expect.any(String), "Inference failed")
    expect(s.track.stop).toHaveBeenCalledOnce()
  })
  it("stops the camera when model loading fails", async () => {
    const s = setup(),
      camera = new CameraSession(s.video, s.callbacks, async () => {
        throw new Error("model unavailable")
      })
    await camera.start()
    expect(s.track.stop).toHaveBeenCalledOnce()
    expect(s.callbacks.onError).toHaveBeenCalledWith(expect.any(String), "Initialization failed")
  })
  it("handles physical disconnection", async () => {
    const s = setup(),
      camera = new CameraSession(s.video, s.callbacks, async () => s.detector)
    await camera.start()
    s.track.dispatchEvent(new Event("ended"))
    expect(s.callbacks.onError).toHaveBeenCalledWith(
      expect.stringContaining("disconnected"),
    )
    expect(s.detector.close).toHaveBeenCalledOnce()
  })
  it("requires a secure context without requesting video", async () => {
    const s = setup()
    vi.stubGlobal("window", { isSecureContext: false })
    await new CameraSession(
      s.video,
      s.callbacks,
      async () => s.detector,
    ).start()
    expect(s.getUserMedia).not.toHaveBeenCalled()
    expect(s.callbacks.onError).toHaveBeenCalledWith(
      expect.stringContaining("HTTPS"),
    )
  })
  it.each([
    "NotAllowedError",
    "NotFoundError",
    "NotReadableError",
    "OverconstrainedError",
  ])("explains %s without exposing internal errors", (name) => {
    const error = new Error("internal-detail")
    error.name = name
    expect(cameraError(error)).not.toContain("internal-detail")
    expect(cameraError(error)).not.toContain("could not start")
  })
})
