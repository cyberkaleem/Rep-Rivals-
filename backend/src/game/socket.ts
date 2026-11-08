import { randomBytes, createHash } from "node:crypto"
import type { Server as HttpServer } from "node:http"
import { Server } from "socket.io"
import { z } from "zod"
import type { AuthService } from "../auth/service.js"
import type { GameStore } from "./store.js"
import { Arena, GameError } from "./arena.js"

const ticketHash = (key: string) =>
  createHash("sha256").update(key).digest("hex")
const activity = z.strictObject({ id: z.uuid() })
const actions = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("profile") }),
  z.strictObject({
    type: z.literal("outfit"),
    outfit: z.enum(["ember", "tide", "violet"]),
  }),
  z.strictObject({
    type: z.literal("create"),
    kind: z.enum(["solo", "battle"]),
  }),
  z.strictObject({
    type: z.literal("join"),
    code: z.string().regex(/^[A-F0-9]{8}$/),
  }),
  ...(["ready", "leave", "finish"] as const).map((type) =>
    activity.extend({ type: z.literal(type) }),
  ),
  activity.extend({
    type: z.literal("rep"),
    seq: z.number().int().positive().max(1000000),
    observed: z.number().int().positive(),
  }),
])

export function createGame(
  auth: AuthService,
  store: GameStore,
  origins: string[],
) {
  const grants = new Map<string, {
    digest: string
    origin: string
    until: number
  }>()
  function issue(digest: string, origin: string) {
    for (const [key, g] of grants)
      if (g.digest === digest || g.until <= Date.now()) grants.delete(key)
    const key = randomBytes(32).toString("base64url")
    grants.set(ticketHash(key), { digest, origin, until: Date.now() + 15000 })
    return key
  }
  function attach(server: HttpServer) {
    const io = new Server(server, {
      transports: ["websocket"],
      maxHttpBufferSize: 2048,
      serveClient: false,
      allowRequest: (req, done) =>
        done(
          null,
          [...origins, "https://localhost"].includes(req.headers.origin ?? ""),
        ),
    })
    const connected = (id: string) => !!io.sockets.adapter.rooms.get(id)?.size
    const arena = new Arena(
      store,
      (id, room) => {
        io.to(id).emit("room", room)
      },
      connected,
    )
    io.use(async (socket, next) => {
      try {
        const key = socket.handshake.auth.ticket
        if (typeof key !== "string" || key.length !== 43) throw Error()
        const hash = ticketHash(key),
          grant = grants.get(hash)
        if (
          !grant ||
          grant.origin !== socket.handshake.headers.origin ||
          grant.until <= Date.now()
        )
          throw Error()
        grants.delete(hash)
        const user = await auth.me(grant.digest)
        socket.data.player = {
          id: user.id,
          username: user.username,
          outfit: (await store.profile(user.id)).outfit,
        }
        socket.data.digest = grant.digest
        next()
      } catch {
        next(Error("Sign in again to connect."))
      }
    })
    io.on("connection", (socket) => {
      const p = socket.data.player
      socket.join(p.id)
      arena.presence(p.id)
      socket.emit("welcome", { id: p.id, room: arena.current(p.id) })
      let pending = 0,
        queue = Promise.resolve(),
        validated = Date.now()
      const check = async () => {
        try {
          await auth.me(socket.data.digest)
          validated = Date.now()
        } catch {
          socket.disconnect(true)
          throw new GameError("Session expired. Sign in again.")
        }
      }
      const timer = setInterval(() => {
        void check().catch(() => {})
      }, 15000)
      socket.on("disconnect", () => {
        clearInterval(timer)
        arena.presence(p.id)
      })
      socket.on("game", (data: unknown, ack: unknown) => {
        if (typeof ack !== "function") return
        if (pending >= 4) {
          ack({ error: "Too many pending actions." })
          return
        }
        const parsed = actions.safeParse(data)
        if (!parsed.success) {
          ack({ error: "Invalid action." })
          return
        }
        const a = parsed.data,
          received = Date.now()
        pending++
        queue = queue
          .then(async () => {
            if (!socket.connected) return
            if (a.type !== "rep" || Date.now() - validated > 2000) await check()
            if (!socket.connected) return
            let value: unknown = null
            switch (a.type) {
              case "profile":
                value = await store.profile(p.id)
                break
              case "outfit":
                await store.outfit(p.id, a.outfit)
                p.outfit = a.outfit
                break
              case "join":
                value = arena.join(p, a.code)
                break
              case "create":
                value = arena.create(p, a.kind)
                break
              case "leave":
                arena.leave(p.id, a.id)
                break
              case "ready":
                arena.ready(p.id, a.id)
                break
              case "rep":
                if (Date.now() - received > 1500)
                  throw new GameError("Rep arrived too late to process.")
                arena.rep(p.id, a.id, a.seq, a.observed, received)
                break
              case "finish":
                value = await arena.finishSolo(p.id, a.id)
                break
            }
            ack({ value })
          })
          .catch((e) =>
            ack({
              error:
                e instanceof GameError
                  ? e.message
                  : "Action unavailable. Please retry.",
            }),
          )
          .finally(() => {
            pending--
          })
      })
    })
    const clock = setInterval(() => {
      void arena.tick()
    }, 125)
    return async () => {
      clearInterval(clock)
      await io.close()
      await arena.tick()
    }
  }
  return { issue, attach }
}
export type Game = ReturnType<typeof createGame>
