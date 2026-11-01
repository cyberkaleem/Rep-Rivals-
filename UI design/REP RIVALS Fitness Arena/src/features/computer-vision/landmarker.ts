import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision"

export async function createLandmarker(): Promise<PoseLandmarker> {
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
  try {
    return await PoseLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: "GPU" },
    })
  } catch {
    return PoseLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: "CPU" },
    })
  }
}
