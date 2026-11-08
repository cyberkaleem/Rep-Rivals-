import { useCallback, useEffect, useRef, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { nativeAccount } from "../auth/api"
import { io, type Socket } from "socket.io-client"

export type Outfit = "ember" | "tide" | "violet"
export interface Player {
  id: string
  username: string
  outfit: Outfit
  online: boolean
  ready: boolean
  score: number
  seq: number
  outcome?: string
  reward?: { xp: number; crystals: number }
}
export interface Room {
  id: string
  code: string
  kind: "battle" | "solo"
  phase: "WAITING" | "READY" | "COUNTDOWN" | "ACTIVE" | "SAVING" | "COMPLETED"
  starts: number
  ends: number
  players: Player[]
  serverNow: number
}
export interface Profile {
  id: string
  username: string
  outfit: Outfit
  xp: number
  crystals: number
  rank: { name: string; floor: number; next: number | null }
  reps: number
  workouts: number
  wins: number
  losses: number
  draws: number
  dailyComplete: boolean
  dailyBattle: boolean
  history: {
    outcome: string
    score: number
    activity: {
      id: string
      kind: string
      startedAt: string
      finishedAt: string
      players: { user: { username: string }; score: number }[]
    }
  }[]
}
async function getGrant() {
  if (Capacitor.getPlatform() === "android")
    return nativeAccount.request({ operation: "ticket" })
  const response = await fetch("/api/auth/ticket", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })
  return {
    status: response.status,
    ticket: response.ok ? (await response.json()).ticket as string : undefined,
    origin: location.origin,
  }
}

export function useGame(enabled = true) {
  const channel = useRef<Socket | null>(null)
  const [state, setState] = useState("Connecting"),
    [attempt, setAttempt] = useState(0)
  const [room, setRoom] = useState<Room | null>(null),
    [user, setUser] = useState("")
  const offset = useRef(0)
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  useEffect(() => {
    let live = true,
      socket: Socket | undefined,
      timer: ReturnType<typeof setTimeout> | undefined
    if (!enabled) {
      setState("Local only")
      setRoom(null)
      return
    }
    setState("Connecting")
    async function connect() {
      try {
        const grant = await getGrant()
        if (!live) return
        if (grant.status === 401) {
          setState("Sign in required")
          setRoom(null)
          setUser("")
          return
        }
        if (!grant.ticket || !grant.origin) throw Error()
        socket = io(grant.origin, {
          transports: ["websocket"],
          auth: { ticket: grant.ticket },
          reconnection: false,
          forceNew: true,
          autoConnect: false,
        })
        channel.current = socket
        const update = (next: Room | null) => {
          if (next) offset.current = next.serverNow - Date.now()
          setRoom(next)
        }
        socket.on("room", update)
        socket.on("welcome", (data: { id: string; room: Room | null }) => {
          update(data.room)
          setUser(data.id)
          setState("Connected")
        })
        socket.on("disconnect", () => {
          if (live) {
            setState("Disconnected")
            timer = setTimeout(retry, 2500)
          }
        })
        socket.on("connect_error", () => {
          if (live) setState("Connection unavailable")
        })
        socket.connect()
      } catch {
        if (live) setState("Connection unavailable")
      }
    }
    // A discarded effect must not issue a second ticket that invalidates the live handshake.
    queueMicrotask(() => { if (live) void connect() })
    return () => {
      live = false
      clearTimeout(timer)
      channel.current = null
      socket?.removeAllListeners()
      socket?.disconnect()
    }
  }, [attempt, retry, enabled])
  const send = useCallback(
    async <T = void,>(
      type: string,
      fields: Record<string, unknown> = {},
    ): Promise<T> => {
      const socket = channel.current
      if (!socket?.connected) throw Error("Offline. Reconnect to continue.")
      const data =
        type === "rep"
          ? { ...fields, observed: Date.now() + offset.current }
          : fields
      const result = await socket
        .timeout(20000)
        .emitWithAck("game", { type, ...data })
      if (result.error) throw Error(result.error)
      return result.value as T
    },
    [],
  )
  return { state, user, room, offset, send, retry }
}
