import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"
import { browserRival } from "../../UI design/REP RIVALS Fitness Arena/tests/live/game-rival.mjs"
import { gameStore } from "../dist/game/store.js"

// A real Android player and a Chromium rival. Chromium alone uses test landmarks.
export async function verifyAndroidGame(ui, db, back) {
  const username = "rival_" + randomBytes(8).toString("hex"),
    email = username + "@example.invalid"
  let rival
  const click = async (label) => {
    const button =
      '[...document.querySelectorAll("button")].find(b=>b.textContent===' +
      JSON.stringify(label) +
      ")"
    await ui.waitFor("!!(" + button + ")")
    await ui.evaluate(button + ".click();true")
  }
  try {
    await ui.visit("/dashboard")
    await ui.waitFor('!!document.querySelector(".swatches")')
    assert.ok(await ui.evaluate('!document.querySelector(".history-row") && document.querySelector(".big-score").textContent.trim()==="0 XP" && document.querySelector(".swatches [aria-pressed=true]")?.textContent==="ember"'))
    await ui.waitFor('!!document.querySelector(".athletes canvas")')
    const draws = await ui.evaluate(`new Promise(resolve => {
      const gl = document.querySelector(".athletes canvas").getContext("webgl2")
      const original = gl.drawElements
      let calls = 0
      gl.drawElements = function(...args) { if (args[1] > 0) calls++; return original.apply(this,args) }
      setTimeout(() => { delete gl.drawElements; resolve(calls) }, 1200)
    })`)
    assert.ok(draws > 0, "Three.js submitted indexed 3D geometry")
    assert.ok(
      await ui.evaluate(
        '!!document.querySelector(".athletes canvas").getContext("webgl2")',
      ),
    )
    assert.ok(
      await ui.evaluate("document.documentElement.scrollWidth<=innerWidth"),
    )
    await click("violet")
    await ui.waitFor(
      'document.querySelector(".swatches [aria-pressed=true]")?.textContent==="violet"',
    )
    await ui.visit("/arena")
    await click("Create room")
    await ui.waitFor('!!document.querySelector(".scoreboard")')
    const code = await ui.evaluate(
      'document.querySelector(".stat-row b").textContent',
    )
    assert.match(code, /^[A-F0-9]{8}$/)
    rival = await browserRival({
      username,
      email,
      password: randomBytes(24).toString("hex"),
    })
    await rival.join(code)
    await ui.waitFor('document.querySelectorAll(".scoreboard > div").length === 2')
    const kits = await ui.evaluate(`new Promise(resolve => {
      const canvas = document.querySelector(".athletes canvas"), gl = canvas.getContext("webgl2")
      const draw = gl.drawElements
      gl.drawElements = function(...args) {
        const result = draw.apply(this,args)
        delete gl.drawElements
        queueMicrotask(() => {
          const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
          const pixels = new Uint8Array(w*h*4)
          gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels)
          const n = [0,0], sum = [0,0]
          for(let i=0;i<pixels.length;i+=16) {
            const [r,g,b] = pixels.subarray(i,i+3)
            const kit = b > r*1.1 && r > g*1.12 && b>100 ? 0 : r > g*1.45 && g > b*1.4 && r>150 ? 1 : -1
            if(kit>=0){n[kit]++;sum[kit]+=(i/4)%w}
          }
          resolve({n, separation:Math.abs(sum[0]/n[0]-sum[1]/n[1])/w})
        })
        return result
      }
    })`)
    assert.ok(kits.n.every(n => n > 10) && kits.separation > .1, "Both colored athletes must render separately")
    console.log("Pixel 7 rendered both outfit colors at distinct positions.")
    await click("Ready to battle")
    await ui.waitFor(
      'document.querySelector(".stat-row")?.textContent.includes("COUNTDOWN")',
    )
    await rival.score()
    await ui.waitFor(
      '[...document.querySelectorAll(".scoreboard b")].some(b=>b.textContent==="1")',
    )
    console.log(
      "Pixel 7 registered a room, rendered 3D, synchronized countdown and opponent fixture score.",
    )
    await delay(60000)
    await ui.waitFor('!!document.querySelector(".battle-result")')
    const opponent = await db.prisma.user.findUniqueOrThrow({where:{email}, select:{id:true}})
    const summary = await gameStore(db.prisma).profile(opponent.id)
    assert.equal(summary.workouts, 1)
    assert.equal(summary.wins, 1)
    assert.equal(summary.reps, 2)
    assert.equal(summary.xp, 45)
    assert.equal(summary.crystals, 4)
    assert.ok(
      await ui.evaluate(
        'document.querySelector(".battle-result h2").textContent.includes(' +
          JSON.stringify(username) +
          ")",
      ),
    )
    await click("Return to lobby")
    await ui.visit("/profile")
    await ui.waitFor('!!document.querySelector(".history-row")')
    assert.ok(
      await ui.evaluate(
        'document.querySelector(".history-row").textContent.includes(' +
          JSON.stringify(username) +
          ")",
      ),
    )
    await ui.tapLink("/progression")
    await ui.waitFor('document.querySelector("h1")?.textContent==="Progression"')
    back()
    await ui.waitFor('location.pathname==="/profile"')
    await ui.visit("/account")
    await ui.waitFor('!!document.querySelector(".account-panel dl")')
    console.log("Pixel 7 match result and persisted player history passed.")
  } finally {
    await rival?.close()
    const player = await db.prisma.user.findFirst({
      where: { email, username },
      select: { id: true },
    })
    if (player) {
      const rows = await db.prisma.activityPlayer.findMany({
        where: { userId: player.id },
        select: { activityId: true },
      })
      await db.prisma.$transaction([
        db.prisma.activity.deleteMany({
          where: { id: { in: rows.map((r) => r.activityId) } },
        }),
        db.prisma.authenticationSession.deleteMany({
          where: { userId: player.id },
        }),
        db.prisma.user.delete({ where: { id: player.id } }),
      ])
    }
  }
}
