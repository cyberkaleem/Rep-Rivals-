import { randomBytes, randomUUID } from "node:crypto"
import { award, type GameStore, type Outcome } from "./store.js"

export class GameError extends Error {}
type Phase = "WAITING" | "READY" | "COUNTDOWN" | "ACTIVE" | "SAVING" | "COMPLETED"
interface Member {
  id: string
  username: string
  outfit: string
  ready: boolean
  offsets: number[]
  seq: number
  observed: number
  outcome?: Outcome
}
interface Room {
  id: string
  code: string
  kind: "battle" | "solo"
  phase: Phase
  players: Member[]
  created: number
  starts: number
  ends: number
  saving: boolean
  retry: number
}
export type Identity = Pick<Member, "id" | "username" | "outfit">
export const battleMs = 60000
const lobbyMs = 10 * 60000,
  soloMaxMs = 30 * 60000

export class Arena {
  private rooms = new Map<string, Room>()
  private codes = new Map<string, Room>()
  private membership = new Map<string, Room>()
  constructor(
    private store: Pick<GameStore, "finish">,
    private emit: (
      user: string,
      state: ReturnType<Arena["view"]> | null,
    ) => void,
    private online: (user: string) => boolean,
    private now = Date.now,
  ) {}

  view(room: Room) {
    return {
      id: room.id,
      kind: room.kind,
      phase: room.phase,
      code: room.code,
      starts: room.starts,
      ends: room.ends,
      serverNow: this.now(),
      players: room.players.map((p) => ({
        id: p.id,
        username: p.username,
        outfit: p.outfit,
        ready: p.ready,
        online: this.online(p.id),
        score: p.offsets.length,
        seq: p.seq,
        outcome: p.outcome,
        reward: p.outcome ? award(p.offsets.length, p.outcome) : null,
      })),
    }
  }
  current(id: string) {
    const room = this.membership.get(id)
    return room ? this.view(room) : null
  }
  presence(id: string) {
    const room = this.membership.get(id)
    if (room) this.broadcast(room)
  }
  private broadcast(room: Room) {
    const state = this.view(room)
    for (const p of room.players) {
      if (this.membership.get(p.id) === room) this.emit(p.id, state)
    }
  }
  private member(p: Identity): Member {
    return { ...p, ready: false, offsets: [], seq: 0, observed: 0 }
  }
  private free(id: string) {
    const old = this.membership.get(id)
    if (old?.phase === "COMPLETED") this.membership.delete(id)
    else if (old)
      throw new GameError("Finish or leave your current activity first.")
  }
  create(p: Identity, kind: Room["kind"]) {
    this.free(p.id)
    const time = this.now()
    let code = ""
    if (kind === "battle")
      do {
        code = randomBytes(4).toString("hex").toUpperCase()
      } while (this.codes.has(code))
    const room: Room = {
      id: randomUUID(),
      code,
      kind,
      phase: kind === "solo" ? "ACTIVE" : "WAITING",
      players: [this.member(p)],
      starts: kind === "solo" ? time : 0,
      ends: kind === "solo" ? time + soloMaxMs : 0,
      created: time,
      saving: false,
      retry: 0,
    }
    this.rooms.set(room.id, room)
    this.membership.set(p.id, room)
    if (code) this.codes.set(code, room)
    this.broadcast(room)
    return this.view(room)
  }
  join(p: Identity, code: string) {
    const room = this.codes.get(code)
    if (
      !room ||
      room.phase !== "WAITING" ||
      this.now() >= room.created + lobbyMs
    )
      throw new GameError("Room full, expired or unavailable.")
    this.free(p.id)
    room.players.push(this.member(p))
    this.membership.set(p.id, room)
    room.phase = "READY"
    this.broadcast(room)
    return this.view(room)
  }
  private lookup(user: string, id: string) {
    const room = this.membership.get(user)
    if (!room || room.id !== id) throw new GameError("Activity unavailable.")
    return room
  }
  ready(user: string, id: string) {
    const room = this.lookup(user, id)
    if (room.phase !== "READY")
      throw new GameError("Both players must join before readying.")
    room.players.find((p) => p.id === user)!.ready = true
    if (room.players.every((p) => p.ready && this.online(p.id))) {
      room.starts = this.now() + 5000
      room.ends = room.starts + battleMs
      room.phase = "COUNTDOWN"
    }
    this.broadcast(room)
  }
  rep(
    user: string,
    id: string,
    seq: number,
    observed: number,
    time = this.now(),
  ) {
    const room = this.lookup(user, id)
    if (
      !Number.isSafeInteger(observed) ||
      Math.abs(time - observed) > 3000 ||
      observed < room.starts ||
      observed >= room.ends
    )
      throw new GameError("Stale or out-of-window rep.")
    if (room.phase === "COUNTDOWN" && time >= room.starts && time < room.ends)
      room.phase = "ACTIVE"
    if (room.phase !== "ACTIVE" || time < room.starts || time >= room.ends)
      throw new GameError("Outside the scoring window.")
    const p = room.players.find((player) => player.id === user)!
    const offset = time - room.starts,
      prior = p.offsets.at(-1) ?? 0
    if (
      !Number.isSafeInteger(seq) ||
      seq <= p.seq ||
      observed <= p.observed ||
      offset - prior < 500
    )
      throw new GameError("Repeated, out-of-order or too-fast rep.")
    p.offsets.push(offset)
    p.seq = seq
    p.observed = observed
    this.broadcast(room)
  }
  leave(user: string, id: string) {
    const room = this.lookup(user, id)
    if (room.phase === "COMPLETED") {
      this.membership.delete(user)
      this.emit(user, null)
      return
    }
    if (
      room.phase === "WAITING" ||
      room.phase === "READY" ||
      (room.kind === "solo" && room.phase === "ACTIVE")
    )
      this.remove(room)
    else throw new GameError("The battle will finish at its original deadline.")
  }
  private remove(room: Room) {
    this.rooms.delete(room.id)
    if (this.codes.get(room.code) === room) this.codes.delete(room.code)
    for (const p of room.players)
      if (this.membership.get(p.id) === room) {
        this.membership.delete(p.id)
        this.emit(p.id, null)
      }
  }
  async finishSolo(user: string, id: string) {
    const room = this.lookup(user, id)
    if (room.kind !== "solo") throw new GameError("The server ends battles.")
    if (room.phase === "ACTIVE") {
      if (this.now() >= room.ends) {
        this.remove(room)
        throw new GameError("Workout expired.")
      }
      room.ends = this.now()
      room.phase = "SAVING"
    }
    if (room.phase === "SAVING") await this.save(room)
    return this.view(room)
  }
  private async save(room: Room) {
    if (room.saving || this.now() < room.retry) return
    room.saving = true
    try {
      const high = Math.max(...room.players.map((p) => p.offsets.length))
      const tied = room.players.every((p) => p.offsets.length === high)
      const results = room.players.map((p) => ({
        id: p.id,
        offsets: p.offsets,
        outcome: (room.kind === "solo"
          ? "solo"
          : tied
            ? "draw"
            : p.offsets.length === high
              ? "win"
              : "loss") as Outcome,
      }))
      await this.store.finish({
        id: room.id,
        kind: room.kind,
        starts: room.starts,
        ends: room.ends,
        players: results,
      })
      results.forEach((r, i) => {
        room.players[i].outcome = r.outcome
      })
      room.phase = "COMPLETED"
      this.broadcast(room)
    } catch {
      room.retry = this.now() + 3000
      console.error("Activity persistence unavailable. Retrying.")
    } finally {
      room.saving = false
    }
  }
  async tick() {
    const time = this.now(),
      saves: Promise<void>[] = []
    for (const room of this.rooms.values()) {
      if (
        ((room.phase === "WAITING" || room.phase === "READY") &&
          time >= room.created + lobbyMs) ||
        (room.phase === "COMPLETED" && time >= room.ends + lobbyMs)
      ) {
        this.remove(room)
        continue
      }
      if (room.phase === "COUNTDOWN" && time >= room.starts) {
        room.phase = "ACTIVE"
        this.broadcast(room)
      }
      if (room.phase === "ACTIVE" && time >= room.ends) {
        if (room.kind === "solo") {
          this.remove(room)
          continue
        }
        room.phase = "SAVING"
        this.broadcast(room)
      }
      if (room.phase === "SAVING") saves.push(this.save(room))
    }
    await Promise.all(saves)
  }
}
