import { defineConfig } from "@playwright/test"
const port = Number(process.env.REP_RIVALS_TEST_PORT ?? 5173)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid browser test port")
const baseURL = `http://127.0.0.1:${port}`
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    headless: true,
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `pnpm dev --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30000,
  },
})
