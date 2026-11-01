import { access } from "node:fs/promises"
try {
  await Promise.all(
    [
      "pose_landmarker_lite.task",
      "wasm/vision_wasm_internal.wasm",
      "wasm/vision_wasm_internal.js",
    ].map((file) =>
      access(new URL(`../public/vision/${file}`, import.meta.url)),
    ),
  )
} catch {
  throw new Error(
    "Vision assets missing. Run pnpm setup:vision before starting or building REP RIVALS.",
  )
}
