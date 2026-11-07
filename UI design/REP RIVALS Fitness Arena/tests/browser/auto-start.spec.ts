import { expect, test, type Page } from "@playwright/test"

// Only replace detector output in this test browser. Camera lifecycle, posture
// validation, calibration, countdown, and rep counting all run normally.
test.beforeEach(async ({ page }) => {
  await page.route("**/src/features/computer-vision/landmarker.ts*", route => route.fulfill({
    contentType: "application/javascript",
    body: `
      export function createLandmarker() {
        return {
          delegate: "CPU", runningMode: "VIDEO", close() {},
          detectForVideo() {
            const pose = document.documentElement.dataset.testPose;
            if (!pose) return { landmarks: [] };
            const points = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
            const elbow = pose === "bottom" ? [0.32, 0.48] : [0.2, 0.55];
            const joints = [[0.2, 0.4], elbow, [0.2, 0.7], [0.45, 0.4], [0.65, 0.4], [0.85, 0.4]];
            [11, 13, 15, 23, 25, 27].forEach((id, i) => {
              points[id] = { x: joints[i][0], y: joints[i][1], visibility: 1 };
            });
            return { landmarks: [points] };
          }
        };
      }`,
  }))
  await page.goto("/training")
})

async function pose(page: Page, position: "top" | "bottom" | "") {
  await page.evaluate(value => { document.documentElement.dataset.testPose = value }, position)
}

test("manual start works with Auto Start off and during a countdown", async ({ page }) => {
  const toggle = page.getByRole("checkbox", { name: "Auto Start" })
  const start = page.getByRole("button", { name: "Start training" })
  const countdown = page.locator(".training-countdown")
  await expect(toggle).not.toBeChecked()
  await pose(page, "top")
  await page.getByRole("button", { name: "Enable camera" }).click()
  await expect(start).toBeEnabled()
  await expect(countdown).toHaveCount(0)
  await start.click()
  await page.getByRole("button", { name: "End session" }).click()
  await page.getByRole("button", { name: "New camera session" }).click()
  await expect(start).toBeEnabled()
  await toggle.check()
  await expect(countdown).toContainText("5")
  await start.click()
  await expect(countdown).toHaveCount(0)
  await expect(page.getByRole("button", { name: "End session" })).toBeVisible()
  // Holding the same pose past the original deadline must not restart the clock.
  await expect(page.locator(".training-score b")).toHaveText("00:06", { timeout: 8500 })
})

test("hands-free start requires uninterrupted calibration and counts only workout reps", async ({ page }) => {
  const countdown = page.locator(".training-countdown")
  const reps = page.getByTestId("rep-count")
  const toggle = page.getByRole("checkbox", { name: "Auto Start" })
  await toggle.check()
  await page.getByRole("button", { name: "Enable camera" }).click()
  await expect(page.getByText("TRACKING LOST", { exact: true })).toBeVisible()
  await expect(countdown).toHaveCount(0)
  await pose(page, "top")
  await expect(countdown).toContainText("4")
  await pose(page, "")
  await expect(countdown).toHaveCount(0)
  await pose(page, "top")
  await expect(countdown).toContainText("5")
  await pose(page, "bottom")
  await expect(countdown).toHaveCount(0)
  await pose(page, "top")
  await expect(countdown).toContainText("5")
  await toggle.uncheck()
  await expect(countdown).toHaveCount(0)
  await toggle.check()
  for (const second of [5, 4, 3, 2, 1]) {
    await expect(countdown.locator("strong")).toHaveText(String(second))
    await expect(reps).toHaveText("0")
  }
  await expect(page.getByRole("button", { name: "End session" })).toBeVisible()
  await expect(countdown).toHaveCount(0)
  await expect(reps).toHaveText("0")
  await expect(page.locator(".training-feedback")).toContainText("Ready. Lower your body.")
  await pose(page, "bottom")
  await expect(page.getByText("BOTTOM CONFIRMED", { exact: true })).toBeVisible()
  // Model a controlled physical rep longer than the minimum cycle duration.
  await page.waitForTimeout(700)
  await pose(page, "top")
  await expect(reps).toHaveText("1")
  await page.getByText("Inference diagnostics", { exact: true }).click()
  await page.getByText("Left joint readings", { exact: true }).click()
  const hip = page.locator(".joint-readings[open] tbody tr").filter({ has: page.getByRole("rowheader", { name: "hip", exact: true }) })
  await expect(hip.getByRole("cell").nth(1)).toHaveText("1.000")
  await expect(hip.getByRole("cell").nth(2)).toHaveText("—")
})

test("recalibration, hiding, stopping and leaving the page clear the countdown", async ({ page }) => {
  const countdown = page.locator(".training-countdown")
  await page.getByRole("checkbox", { name: "Auto Start" }).check()
  await pose(page, "top")
  const enable = page.getByRole("button", { name: "Enable camera" })
  await enable.click()
  await expect(countdown).toContainText("4")
  await page.getByRole("button", { name: "Recalibrate" }).click()
  await expect(countdown).toHaveCount(0)
  await expect(countdown).toContainText("5")
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true })
    document.dispatchEvent(new Event("visibilitychange"))
    Reflect.deleteProperty(document, "hidden")
  })
  await expect(countdown).toHaveCount(0)
  await enable.click()
  await expect(countdown).toContainText("5")
  await page.getByRole("button", { name: "Stop camera" }).click()
  await expect(countdown).toHaveCount(0)
  await enable.click()
  await expect(countdown).toContainText("5")
  const track = await page.locator("video").evaluateHandle(video => (video.srcObject as MediaStream).getVideoTracks()[0])
  await page.getByRole("link", { name: "Back to home" }).click()
  await expect(page).toHaveURL("/")
  await expect.poll(() => track.evaluate(value => value.readyState)).toBe("ended")
  await page.getByRole("link", { name: "Try real camera training" }).click()
  await expect(countdown).toHaveCount(0)
  await expect(page.getByRole("checkbox", { name: "Auto Start" })).not.toBeChecked()
  await expect(enable).toBeVisible()
})
