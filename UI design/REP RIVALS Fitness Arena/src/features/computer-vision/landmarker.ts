import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision"
import { Capacitor } from "@capacitor/core"
import type { Detector, Delegate } from "./cameraSession"

export async function createLandmarker(): Promise<Detector> {
  const base = import.meta.env.BASE_URL
  const fileset = await FilesetResolver.forVisionTasks(`${base}vision/wasm`)
  const options = {
    baseOptions: { modelAssetPath: `${base}vision/pose_landmarker_lite.task` },
    runningMode: "VIDEO" as const,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  }
  async function load(delegate: Delegate): Promise<Detector> {
    const model = await PoseLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate },
    })
    return {
      delegate,
      runningMode: options.runningMode,
      detectForVideo: (video, timestamp) => model.detectForVideo(video, timestamp),
      close: () => model.close(),
    }
  }
  // The API 35 emulator GPU returned empty results on a known pose even
  // though initialization succeeded. CPU detected it using the same assets.
  if (Capacitor.getPlatform() === "android") return load("CPU")
  try {
    return await load("GPU")
  } catch {
    return load("CPU")
  }
}
