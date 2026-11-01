import { test, expect } from "@playwright/test"

test("training route is reachable, responsive, and never requests the camera automatically", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new Error("Unexpected automatic camera request")
    }
  })
  await page.goto("/")
  await page.getByRole("link", { name: "Try real camera training" }).click()
  await expect(page.getByRole("heading", { name: "REAL REPS." })).toBeVisible()
  await expect(page.getByTestId("rep-count")).toHaveText("0")
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  }
  await page.screenshot({
    path: "test-results/training-mobile.png",
    fullPage: true,
  })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.screenshot({
    path: "test-results/training-desktop.png",
    fullPage: true,
  })
  expect(errors).toEqual([])
})

for (const [name, message] of [
  ["NotAllowedError", "Camera permission denied"],
  ["NotFoundError", "No camera found"],
]) {
  test(`explains ${name} and permits retry`, async ({ page }) => {
    await page.addInitScript((errorName) => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("fixture", errorName)
      }
    }, name)
    await page.goto("/training")
    await page.getByRole("button", { name: "Enable camera" }).click()
    await expect(page.getByRole("alert")).toContainText(message)
    await expect(
      page.getByRole("button", { name: "Enable camera" }),
    ).toBeEnabled()
    await expect(page.getByTestId("rep-count")).toHaveText("0")
  })
}

test("real MediaPipe loads on fake video, cannot calibrate without a body, and releases camera on exit", async ({
  page,
}) => {
  // Browser-provided test pattern, NOT a real athlete or evidence of CV accuracy.
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const uploads: string[] = []
  page.on("request", (req) => {
    if (req.method() === "POST") uploads.push(req.url())
  })
  await page.goto("/training")
  await page.getByRole("button", { name: "Enable camera" }).click()
  await expect(page.getByText("Camera active · tracking locally")).toBeVisible({
    timeout: 45000,
  })
  await expect(page.getByText("TRACKING LOST", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Start training" }),
  ).toBeDisabled()
  await expect(page.getByTestId("rep-count")).toHaveText("0")
  const track = await page
    .locator("video")
    .evaluateHandle(
      (video) => (video.srcObject as MediaStream).getVideoTracks()[0],
    )
  await page.getByRole("button", { name: "Stop camera" }).click()
  expect(await track.evaluate((t) => t.readyState)).toBe("ended")
  await page.getByRole("button", { name: "Enable camera" }).click()
  await expect(page.getByText("Camera active · tracking locally")).toBeVisible({
    timeout: 45000,
  })
  const restarted = await page
    .locator("video")
    .evaluateHandle(
      (video) => (video.srcObject as MediaStream).getVideoTracks()[0],
    )
  await page.getByRole("link", { name: "Back to home" }).click()
  await expect(page).toHaveURL("http://127.0.0.1:5173/")
  await expect.poll(() => restarted.evaluate((t) => t.readyState)).toBe("ended")
  expect(uploads).toEqual([])
  expect(errors).toEqual([])
})
