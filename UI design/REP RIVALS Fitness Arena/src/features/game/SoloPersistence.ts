import { useEffect, useRef, useState } from "react"
import { useGame, type Room } from "./connection"

export function useSoloPersistence(enabled: boolean) {
  const game = useGame(enabled)
  const session = useRef<Promise<Room> | null>(null),
    ready = useRef("")
  const [message, setMessage] = useState("Local session · sign in to save")
  const send = game.send
  function begin() {
    ready.current = ""
    if (game.state !== "Connected") {
      setMessage("Local session · no connection to account")
      return
    }
    setMessage("Opening workout…")
    const opening = send<Room>("create", { kind: "solo" })
    session.current = opening
    void opening
      .then((room) => {
        if (session.current === opening) {
          ready.current = room.id
          setMessage("Connected · saving accepted reps")
        }
      })
      .catch(() => {
        if (session.current === opening) {
          session.current = null
          setMessage("Local only · could not open a saved workout")
        }
      })
  }
  function rep(seq: number) {
    if (ready.current)
      void send("rep", { id: ready.current, seq }).catch(() =>
        setMessage(
          "A rep could not be confirmed. Your local count is preserved.",
        ),
      )
  }
  function close(save: boolean) {
    const opening = session.current
    session.current = null
    ready.current = ""
    if (!opening) return
    void opening
      .then(async (room) => {
        if (save) {
          const result = await send<Room>("finish", { id: room.id })
          setMessage(
            result.phase === "COMPLETED"
              ? "Saved · " + result.players[0].score + " official reps"
              : "Saving · check your dashboard",
          )
        } else {
          await send("leave", { id: room.id })
          setMessage("Interrupted · local result only")
        }
      })
      .catch(() =>
        setMessage("Save unconfirmed · reconnect and check your dashboard"),
      )
  }
  useEffect(
    () => () => {
      const pending = session.current
      session.current = null
      if (pending)
        void pending.then((r) => send("leave", { id: r.id })).catch(() => {})
    },
    [send],
  )
  return { game, message, begin, rep, close }
}
