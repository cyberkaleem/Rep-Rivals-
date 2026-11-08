import test from "node:test"
import assert from "node:assert/strict"
import { Arena } from "../src/game/arena.js"
import { award, rank, type ActivityResult } from "../src/game/store.js"

test("one room per player, fixed deadlines, ordered score events and single finalization", async () => {
  let time = 100000
  const lastRoom = new Map<string, string | undefined>()
  const saved: ActivityResult[] = [],
    online = new Set(["a", "b", "c"])
  const arena = new Arena(
    {
      finish: async (r) => {
        saved.push(r)
      },
    },
    (user, room) => lastRoom.set(user, room?.id),
    (id) => online.has(id),
    () => time,
  )
  const p = (id: string) => ({ id, username: id, outfit: "ember" })
  const { id, code } = arena.create(p("a"), "battle")
  assert.throws(() => arena.join(p("a"), code))
  assert.throws(() => arena.ready("a", id))
  arena.join(p("b"), code)
  assert.throws(() => arena.create(p("b"), "solo"))
  assert.throws(() => arena.join(p("c"), code))
  assert.throws(() => arena.ready("c", id))
  arena.ready("a", id)
  arena.ready("b", id)
  const { starts, ends } = arena.current("a")!
  assert.equal(ends - starts, 60000)
  assert.throws(() => arena.ready("a", id))
  assert.throws(() => arena.rep("a", id, 1, time))
  time = starts + 600
  await arena.tick()
  arena.rep("a", id, 1, time)
  assert.throws(() => arena.rep("a", id, 2, time + 1))
  time += 900
  assert.throws(() => arena.rep("a", id, 1, time))
  arena.rep("b", id, 1, time)
  online.delete("b")
  arena.presence("b")
  assert.equal(arena.current("a")!.players[1].online, false)
  online.add("b")
  assert.equal(arena.current("b")!.ends, ends)
  time += 4500
  assert.throws(() => arena.rep("a", id, 2, time - 4000))
  arena.rep("a", id, 2, time)
  time = ends
  assert.throws(() => arena.rep("b", id, 2, time))
  await Promise.all([arena.tick(), arena.tick()])
  await arena.tick()
  assert.equal(saved.length, 1)
  assert.deepEqual(
    saved[0].players.map((p) => p.outcome),
    ["win", "loss"],
  )
  assert.deepEqual(
    arena.current("b")!.players.map((p) => p.score),
    [2, 1],
  )
  const next = arena.create(p("a"), "battle")
  arena.presence("b")
  assert.equal(lastRoom.get("a"), next.id)
  arena.join(p("b"), next.code)
  arena.ready("a", next.id)
  arena.ready("b", next.id)
  time = arena.current("a")!.ends
  await arena.tick()
  assert.deepEqual(saved[1].players.map(player => player.outcome), ["draw", "draw"])
})

test("canceled and expired solo sessions do not earn rewards; completion retries reuse the same result", async () => {
  let time = 100,
    commits = 0
  const a = new Arena(
    {
      finish: async () => {
        commits++
      },
    },
    () => {},
    () => true,
    () => time,
  )
  const p = { id: "a", username: "a", outfit: "ember" }
  const first = a.create(p, "solo")
  a.leave(p.id, first.id)
  const expired = a.create(p, "solo")
  time = expired.ends
  await a.tick()
  assert.equal(a.current("a"), null)
  assert.equal(commits, 0)
  const final = a.create(p, "solo")
  time += 800
  a.rep(p.id, final.id, 1, time)
  await a.finishSolo(p.id, final.id)
  await a.finishSolo(p.id, final.id)
  assert.equal(commits, 1)
  assert.deepEqual(award(0, "win"), { xp: 0, crystals: 0 })
  assert.deepEqual(award(6, "win"), { xp: 55, crystals: 5 })
  assert.deepEqual(
    [0, 299, 300, 1499, 1500].map((x) => rank(x).name),
    ["Noob", "Noob", "Elite", "Elite", "Titan"],
  )
})
