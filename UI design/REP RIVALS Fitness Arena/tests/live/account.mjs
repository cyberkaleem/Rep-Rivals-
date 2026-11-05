import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { preview } from 'vite'

// Called by the guarded backend integration suite with its own loopback server.
export async function verifyAccountBrowser(apiOrigin, player) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  process.env.REP_RIVALS_API_PROXY = apiOrigin
  const site = await preview({ root, preview: { host: '127.0.0.1', port: 5174, strictPort: true } })
  let browser
  try {
    browser = await chromium.launch()
    const page = await browser.newPage()
    const origin = 'http://127.0.0.1:5174'
    await page.goto(origin + '/account')
    await page.waitForURL(origin + '/login')
    await page.getByRole('link', { name: 'Create an account' }).click()
    await page.locator('[name=username]').fill(player.username)
    await page.locator('[name=email]').fill(player.email)
    await page.locator('[name=password]').fill(player.password)
    await page.locator('[name=confirmation]').fill(player.password)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText(player.username, { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText(player.email, { exact: true })).toBeVisible()
    const cookie = (await page.context().cookies()).find(c => c.name === 'rr_session')
    assert.ok(cookie?.httpOnly && cookie.sameSite === 'Lax')
    const storage = await page.evaluate(() => JSON.stringify([document.cookie, localStorage, sessionStorage]))
    assert.ok(!storage.includes(cookie.value) && !storage.includes(player.password))
    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL(origin + '/login')
    await page.locator('[name=email]').fill(player.email)
    await page.locator('[name=password]').fill(player.password)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByText(player.username, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForURL(origin + '/login')
    await page.goto(origin + '/account')
    await page.waitForURL(origin + '/login')
  } finally {
    await browser?.close()
    await site.close()
  }
}
