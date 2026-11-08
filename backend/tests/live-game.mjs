import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"
import { io } from "socket.io-client"
import { developmentConnections } from "../scripts/development.mjs"
import { createDatabase } from "../dist/db/client.js"
import { startServer } from "../dist/server.js"
import { gameStore } from "../dist/game/store.js"

const origin = "http://127.0.0.1:5173"
async function verify() {
  const { direct, pooled } = await developmentConnections(),
    db = createDatabase(direct)
  const api = await startServer({
    healthOnly: false,
    port: 0,
    host: "127.0.0.1",
    databaseUrl: pooled,
    production: false,
    origins: [origin],
    trustedProxies: [],
  })
  const url = "http://127.0.0.1:" + api.server.address().port,
    accounts = [],
    sockets = [],
    activities = []
  async function post(path, body, cookie) {
    return fetch(url + "/api/auth/" + path, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    })
  }
  async function player() {
    const username = "game_" + randomBytes(8).toString("hex"),
      email = username + "@example.invalid"
    accounts.push({ username, email })
    const reg = await post("register", {
      email,
      username,
      password: randomBytes(24).toString("hex"),
    })
    assert.equal(reg.status, 201)
    return {
      cookie: reg.headers.get("set-cookie").split(";")[0],
      id: (await reg.json()).user.id,
    }
  }
  async function ticket(p) {
    const res = await post("ticket", {}, p.cookie)
    assert.equal(res.status, 200)
    return (await res.json()).ticket
  }
  function client(key, expected = true, from = origin) {
    const socket = io(url, {
      autoConnect: false,
      reconnection: false,
      forceNew: true,
      transports: ["websocket"],
      extraHeaders: { Origin: from },
      auth: { ticket: key },
    })
    sockets.push(socket)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Socket timed out")), 12000)
      socket.once("connect_error", () => {
        clearTimeout(timer)
        if (expected) reject(Error("Handshake failed"))
        else resolve(null)
      })
      socket.once("welcome", (snapshot) => {
        clearTimeout(timer)
        if (!expected) reject(Error("Unexpected authorization"))
        else resolve({ socket, snapshot })
      })
      socket.connect()
    })
  }
  const call = (c, type, fields = {}) =>
    c.socket.timeout(20000).emitWithAck("game", { type, ...fields })
  const ok = async (c, type, fields) => {
    const r = await call(c, type, fields)
    assert.equal(r.error, undefined)
    return r.value
  }
  try {
    assert.equal((await post("ticket", {})).status, 401)
    const a = await player(),
      b = await player(),
      key = await ticket(a)
    await client(key, false, "http://untrusted.invalid")
    const first = await client(key)
    await client(key, false)
    let second = await client(await ticket(b))
    const solo = await ok(first, "create", { kind: "solo" })
    activities.push(solo.id)
    for (let seq = 1; seq <= 5; seq++) {
      await delay(650)
      await ok(first, "rep", { id: solo.id, seq, observed: Date.now() })
    }
    await ok(first, "finish", { id: solo.id })
    await ok(first, "finish", { id: solo.id })
    const soloProfile = await ok(first, "profile")
    assert.equal(soloProfile.xp, 40)
    assert.equal(soloProfile.crystals, 3)
    assert.equal(soloProfile.dailyComplete, true)
    await ok(first, "outfit", { outfit: "tide" })
    const room = await ok(first, "create", { kind: "battle" })
    activities.push(room.id)
    await ok(second, "join", { code: room.code })
    assert.ok((await call(second, "create", { kind: "battle" })).error)
    await ok(first, "ready", { id: room.id })
    await ok(second, "ready", { id: room.id })
    second.socket.disconnect()
    second = await client(await ticket(b))
    assert.equal(second.snapshot.room.phase, "COUNTDOWN")
    const { starts, ends } = second.snapshot.room
    assert.equal(ends - starts, 60000)
    const states = []
    second.socket.on("room", (s) => states.push(s))
    await delay(Math.max(0, starts + 800 - Date.now()))
    await ok(first, "rep", { id: room.id, seq: 1, observed: Date.now() })
    assert.ok(
      (await call(first, "rep", { id: room.id, seq: 1, observed: Date.now() }))
        .error,
    )
    await ok(second, "rep", { id: room.id, seq: 1, observed: Date.now() })
    await delay(650)
    await ok(first, "rep", { id: room.id, seq: 2, observed: Date.now() })
    console.log(
      "Two authenticated clients synchronized fixture scores and rejoined the original 60-second round.",
    )
    await delay(Math.max(0, ends - Date.now() + 200))
    assert.ok(
      (await call(first, "rep", { id: room.id, seq: 3, observed: Date.now() }))
        .error,
    )
    for (
      let i = 0;
      i < 80 && !states.some((s) => s?.phase === "COMPLETED");
      i++
    )
      await delay(250)
    const final = states.find((s) => s?.phase === "COMPLETED")
    assert.deepEqual(
      final.players.map((p) => [p.score, p.outcome]),
      [
        [2, "win"],
        [1, "loss"],
      ],
    )
    await gameStore(db.prisma).finish({
      id: room.id,
      kind: "battle",
      starts,
      ends,
      players: [],
    })
    const result = await ok(first, "profile")
    assert.equal(result.xp, 85)
    assert.equal(result.crystals, 7)
    assert.equal(result.wins, 1)
    assert.equal(result.dailyBattle, true)
    assert.equal(result.history.length, 2)
    assert.equal(result.outfit, "tide")
    assert.equal((await ok(second, "profile")).losses, 1)
    const rematchId = crypto.randomUUID()
    activities.push(rematchId)
    const rematch = {
      id: rematchId, kind: "battle", starts, ends,
      players: [a, b].map(p => ({ id: p.id, outcome: "draw", offsets: [800,1600,2400,3200,4000] })),
    }
    await Promise.all([gameStore(db.prisma).finish(rematch), gameStore(db.prisma).finish(rematch)])
    const afterRetry = await ok(first, "profile")
    assert.equal(afterRetry.xp - result.xp, 25)
    assert.equal(afterRetry.crystals - result.crystals, 1)
    assert.equal(afterRetry.draws, 1)
    await post("logout", {}, a.cookie)
    await client(await ticket(b), false, "http://untrusted.invalid")
    assert.equal((await post("ticket", {}, a.cookie)).status, 401)
    console.log(
      "Persisted workout, UTC challenge, match history, winner, cosmetic and idempotent rewards passed.",
    )
  } finally {
    for (const s of sockets) s.disconnect()
    await api.close()
    try {
      for (const id of activities)
        await db.prisma.activity.deleteMany({ where: { id } })
      for (const where of accounts) {
        const u = await db.prisma.user.findFirst({ where })
        if (u)
          await db.prisma.$transaction([
            db.prisma.authenticationSession.deleteMany({
              where: { userId: u.id },
            }),
            db.prisma.user.delete({ where: { id: u.id } }),
          ])
      }
    } finally {
      await db.close()
    }
  }
}
verify().catch((e) => {
  console.error(
    "Gameplay verification failed at",
    e.stack
      ?.split("\n")
      .find((l) => l.includes("live-game.mjs:"))
      ?.match(/live-game\.mjs:(\d+)/)?.[1] ?? "setup",
  )
  process.exitCode = 1
})
