import { chromium, expect } from "@playwright/test"
import { createServer } from "vite"
import { fileURLToPath } from "node:url"

// Only this isolated Chromium client receives fixture landmarks. The shipped application
// still owns calibration, movement validation, rep callbacks, transport and persistence.
function fixtureDetector() {
  return {
    delegate: "CPU",
    runningMode: "VIDEO",
    close() {},
    detectForVideo() {
      const points = Array.from({ length: 33 }, () => ({
        x: 0,
        y: 0,
        visibility: 0,
      }))
      const elbow =
        document.documentElement.dataset.pose === "bottom"
          ? [0.32, 0.48]
          : [0.2, 0.55]
      const joints = [
        [0.2, 0.4],
        elbow,
        [0.2, 0.7],
        [0.45, 0.4],
        [0.65, 0.4],
        [0.85, 0.4],
      ]
      ;[11, 13, 15, 23, 25, 27].forEach((id, i) => {
        points[id] = { x: joints[i][0], y: joints[i][1], visibility: 1 }
      })
      return { landmarks: [points] }
    },
  }
}
export async function browserRival(player) {
  const root = fileURLToPath(new URL("../../", import.meta.url)),
    origin = "http://127.0.0.1:5173"
  process.env.REP_RIVALS_API_PROXY = "https://127.0.0.1:4443"
  const site = await createServer({
    root,
    server: { host: "127.0.0.1", port: 5173, strictPort: true },
    logLevel: "error",
  })
  let browser
  async function close() {
    try {
      await browser?.close()
    } finally {
      await site.close()
    }
  }
  try {
    await site.listen()
    browser = await chromium.launch({
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    })
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    })
    let ticketsRequested = 0
    page.on("request", request => {
      if (new URL(request.url()).pathname === "/api/auth/ticket") ticketsRequested++
    })
    await page.route("**/src/features/computer-vision/landmarker.ts*", (r) =>
      r.fulfill({
        contentType: "application/javascript",
        body: "export const createLandmarker = " + fixtureDetector.toString(),
      }),
    )
    const button = (label) =>
      page.getByRole("button", { name: label, exact: true })
    const pose = async (position) =>
      page.evaluate((value) => {
        document.documentElement.dataset.pose = value
      }, position)
    await page.goto(origin + "/register")
    console.log("Chromium rival registering through the private Vite HTTPS proxy.")
    for (const [name, value] of Object.entries({
      ...player,
      confirmation: player.password,
    }))
      await page.locator("[name=" + name + "]").fill(value)
    await button("Create account").click()
    await page.waitForURL(origin + "/account")
    await page.getByRole("link", { name: "Start solo training" }).click()
    await expect(page.locator(".training-label")).toContainText("Signed in", {
      timeout: 20000,
    })
    await button("Enable camera").click()
    console.log("Chromium solo connection established. Checking fixture calibration and saving.")
    await button("Start training").click()
    await expect(page.locator(".training-label")).toContainText(
      "saving accepted reps",
    )
    await pose("bottom")
    await expect(
      page.getByText("BOTTOM CONFIRMED", { exact: true }),
    ).toBeVisible()
    await page.waitForTimeout(750)
    await pose("top")
    await expect(page.getByTestId("rep-count")).toHaveText("1")
    await button("End session").click()
    await expect(page.locator(".training-score")).toContainText(
      "Saved · 1 official reps",
      { timeout: 20000 },
    )
    await page.goto(origin + "/profile")
    await expect(page.locator(".history-row")).toContainText("1 reps")
    return {
      async join(code) {
        const before = ticketsRequested
        await page.goto(origin + "/arena")
        try {
          await page.getByLabel("Room code").fill(code)
        } catch (error) {
          const status = await page.locator('[role="status"]').first().textContent({timeout:1000}).catch(()=>"")
          console.error("Lobby unavailable:", ["Connecting","Connection unavailable","Sign in required","Disconnected"].find(s=>status?.includes(s)) ?? "room or other state")
          throw error
        }
        expect(ticketsRequested - before).toBe(1)
        await button("Join room").click()
        await button("Enable camera").click()
        await button("Ready to battle").click()
      },
      async score() {
        await expect(page.locator(".stat-row")).toContainText("ACTIVE", {
          timeout: 20000,
        })
        await page.waitForTimeout(1500)
        await pose("bottom")
        await page.waitForTimeout(1100)
        await pose("top")
        await expect(
          page.locator(".scoreboard b").filter({ hasText: /^1$/ }),
        ).toBeVisible({ timeout: 8000 })
      },
      close,
    }
  } catch (error) {
    await close()
    throw error
  }
}
