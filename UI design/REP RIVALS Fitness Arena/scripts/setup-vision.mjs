import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"

// Versioned official Google model, self-hosted alongside matching package WASM.
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
const expectedHash =
  "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a"
const destination = new URL("../public/vision/", import.meta.url)
await mkdir(destination, { recursive: true })
await cp(
  fileURLToPath(
    new URL("../node_modules/@mediapipe/tasks-vision/wasm/", import.meta.url),
  ),
  fileURLToPath(new URL("wasm/", destination)),
  { recursive: true },
)
const modelFile = new URL("pose_landmarker_lite.task", destination)
let model
try {
  model = await readFile(modelFile)
} catch {
  /* First setup. */
}
if (
  !model ||
  createHash("sha256").update(model).digest("hex") !== expectedHash
) {
  const response = await fetch(modelUrl, { signal: AbortSignal.timeout(60000) })
  if (!response.ok)
    throw new Error(`Model download failed: HTTP ${response.status}`)
  model = Buffer.from(await response.arrayBuffer())
  if (createHash("sha256").update(model).digest("hex") !== expectedHash)
    throw new Error("Pose model checksum mismatch; refusing to install it")
  await writeFile(modelFile, model)
}
console.log(
  `Vision assets ready. Model SHA-256: ${createHash("sha256").update(model).digest("hex")}`,
)
