import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Link, useLocation } from "react-router-dom"
import {
  ArrowUpRight,
  Activity,
  Swords,
  Gem,
  Timer,
  Trophy,
} from "lucide-react"
import { useGame, type Outfit, type Profile } from "./connection"
import { usePushUpCamera } from "../computer-vision/usePushUpCamera"
import type { Athlete } from "./Avatars"
const Scene = lazy(() => import("./Avatars"))
function Avatars({ athletes }: { athletes: Athlete[] }) {
  return (
    <Suspense fallback={<div className="athletes">Loading athletes…</div>}>
      <Scene athletes={athletes} />
    </Suspense>
  )
}
import "./game.css"

function Frame({ children }: { children: ReactNode }) {
  return (
    <main className="game-shell">
      <header className="game-nav">
        <Link className="game-logo" to="/">
          REP <em>RIVALS</em>
        </Link>
        <nav>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/arena">Arena</Link>
          <Link to="/account">Account</Link>
        </nav>
      </header>
      {children}
    </main>
  )
}
export function Home() {
  return (
    <Frame>
      <section className="game-hero">
        <div>
          <p className="eyebrow">Fitness arena</p>
          <h1>
            REAL REPS.
            <br />
            <em>REAL RIVALS.</em>
          </h1>
          <p>
            Challenge a friend to a 60-second push-up battle. Your camera
            counts. The arena keeps score.
          </p>
          <Link className="game-cta" to="/arena">
            Enter the arena <ArrowUpRight />
          </Link>
        </div>
      </section>
      <div className="game-tiles">
        <Link to="/training">
          <Activity />
          <strong>Solo training</strong>
          <span>Try real camera training →</span>
        </Link>
        <Link to="/dashboard">
          <Trophy />
          <strong>Player dashboard</strong>
          <span>Rank, rewards and history →</span>
        </Link>
        <Link to="/register">
          <Swords />
          <strong>Join Rep Rivals</strong>
          <span>Create your player account →</span>
        </Link>
      </div>
    </Frame>
  )
}
function Access({ state, retry }: { state: string; retry: () => void }) {
  return (
    <div className="game-card" role="status">
      <p>{state}</p>
      {state === "Sign in required" ? (
        <Link className="game-cta" to="/login">
          Log in
        </Link>
      ) : (
        state !== "Connecting" && (
          <button onClick={retry}>Retry connection</button>
        )
      )}
    </div>
  )
}
export function Dashboard() {
  const game = useGame(),
    [p, setProfile] = useState<Profile | null>(null),
    [error, setError] = useState(""),
    [version, refresh] = useState(0)
  const path = useLocation().pathname
  useEffect(() => {
    let live = true
    if (game.state === "Connected") {
      setError("")
      game
        .send<Profile>("profile")
        .then((data) => {
          if (live) setProfile(data)
        })
        .catch(() => {
          if (live) setError("Could not load player profile.")
        })
    }
    return () => {
      live = false
    }
  }, [game.state, game.send, version])
  const change = async (outfit: Outfit) => {
    try {
      await game.send("outfit", { outfit })
      refresh((n) => n + 1)
    } catch {
      setError("Outfit could not be saved.")
    }
  }
  return (
    <Frame>
      <div className="game-title">
        <p className="eyebrow">Player hub</p>
        <h1>
          {path === "/progression"
            ? "Progression"
            : path === "/profile"
              ? "Player profile"
              : "Dashboard"}
        </h1>
      </div>
      <nav className="game-actions" aria-label="Player hub">
        <Link to="/dashboard">Overview</Link>
        <Link to="/profile">Profile and history</Link>
        <Link to="/progression">Progression</Link>
      </nav>
      {game.state !== "Connected" ? (
        <Access state={game.state} retry={game.retry} />
      ) : (
        <>
          {error && (
            <button onClick={() => refresh((n) => n + 1)}>{error} Retry</button>
          )}
          {!p ? (
            <p>Loading player…</p>
          ) : (
            <>
              <section className="game-grid">
                <div className="game-card">
                  <p className="eyebrow">{p.rank.name}</p>
                  <h2>{p.username}</h2>
                  <Avatars
                    athletes={[
                      { id: p.id, outfit: p.outfit, score: 0, pose: "idle" },
                    ]}
                  />
                  <fieldset className="swatches">
                    <legend>Competition kit</legend>
                    {(["ember", "tide", "violet"] as const).map((o) => (
                      <button
                        key={o}
                        aria-pressed={p.outfit === o}
                        onClick={() => void change(o)}
                      >
                        {o}
                      </button>
                    ))}
                  </fieldset>
                </div>
                <div className="game-card">
                  <h2>Progression</h2>
                  <p className="big-score">
                    {p.xp} <small>XP</small>
                  </p>
                  <progress
                    value={p.xp - p.rank.floor}
                    max={(p.rank.next ?? Math.max(p.xp, 1501)) - p.rank.floor}
                  />
                  <p>
                    {p.rank.next
                      ? p.rank.next - p.xp + " XP to next rank"
                      : "Titan rank reached"}
                  </p>
                  <div className="stat-row">
                    <Gem /> Crystals <strong>{p.crystals}</strong>
                  </div>
                  <div className="stat-row">
                    Official reps <strong>{p.reps}</strong>
                  </div>
                  <div className="stat-row">
                    Solo workouts <strong>{p.workouts}</strong>
                  </div>
                  <div className="stat-row">
                    Wins / losses / draws{" "}
                    <strong>
                      {p.wins} / {p.losses} / {p.draws}
                    </strong>
                  </div>
                </div>
              </section>
              {path !== "/profile" && (
                <section className="game-grid">
                  <div className="game-card">
                    <h2>Daily five</h2>
                    <p>
                      {p.dailyComplete
                        ? "Completed today · reward credited"
                        : "Finish one activity with at least five accepted reps today (UTC)."}
                    </p>
                    <small>15 XP · 2 crystals</small>
                  </div>
                  <div className="game-card">
                    <h2>First duel</h2>
                    <p>
                      {p.dailyBattle
                        ? "Completed today · reward credited"
                        : "Finish a battle with at least one accepted rep today (UTC)."}
                    </p>
                    <small>10 XP · 1 crystal</small>
                  </div>
                </section>
              )}
              <div className="game-actions">
                <Link to="/training?save=1">Train solo</Link>
                <Link className="game-cta" to="/arena">
                  Battle a rival
                </Link>
              </div>
              <section className="game-card">
                <h2>Activity history</h2>
                {!p.history.length ? (
                  <p>Your completed activities appear here.</p>
                ) : (
                  p.history.map((h) => (
                    <div className="history-row" key={h.activity.id}>
                      <div>
                        <strong>
                          {h.activity.kind === "solo"
                            ? "Solo training"
                            : h.activity.players
                                .map((x) => x.user.username)
                                .join(" vs ")}
                        </strong>
                        <small>
                          {new Date(h.activity.finishedAt).toLocaleDateString()}{" "}
                          ·{" "}
                          {Math.round(
                            (Date.parse(h.activity.finishedAt) -
                              Date.parse(h.activity.startedAt)) /
                              1000,
                          )}
                          s · {h.outcome}
                        </small>
                      </div>
                      <b>{h.score} reps</b>
                    </div>
                  ))
                )}
              </section>
            </>
          )}
        </>
      )}
    </Frame>
  )
}

export function Battle() {
  const game = useGame(),
    room = game.room?.kind === "solo" && game.room.phase === "COMPLETED" ? null : game.room,
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false)
  const seq = useRef(0),
    [clock, setClock] = useState(Date.now)
  const me = room?.players.find((p) => p.id === game.user)
  useEffect(() => {
    seq.current = me?.seq ?? 0
  }, [room?.id, game.state])
  const cv = usePushUpCamera(() => {
    if (room?.phase === "ACTIVE" && game.state === "Connected")
      void game
        .send("rep", { id: room.id, seq: ++seq.current })
        .catch((e) => setError(e.message))
  })
  useEffect(() => {
    if (
      room?.phase === "ACTIVE" &&
      room.kind === "battle" &&
      cv.snapshot.calibrated &&
      !cv.running &&
      cv.active
    )
      cv.start()
    if (
      (room?.phase === "SAVING" || room?.phase === "COMPLETED" || !room) &&
      cv.active
    )
      cv.stop()
  }, [
    room?.phase,
    cv.snapshot.state,
    cv.running,
    cv.active,
    cv.snapshot.calibrated,
  ])
  useEffect(() => {
    if (room?.phase !== "COUNTDOWN" && room?.phase !== "ACTIVE") return
    const timer = setInterval(() => setClock(Date.now()), 150)
    return () => clearInterval(timer)
  }, [room?.phase])
  async function act(type: string, fields: Record<string, unknown> = {}) {
    setBusy(true)
    setError("")
    try {
      await game.send(type, fields)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action unavailable.")
    } finally {
      setBusy(false)
    }
  }
  const seconds = room
    ? Math.max(
        0,
        Math.ceil(
          ((room.phase === "COUNTDOWN" ? room.starts : room.ends) -
            (clock + game.offset.current)) /
            1000,
        ),
      )
    : 0
  return (
    <Frame>
      <div className="game-title">
        <p className="eyebrow">Private 1v1 · push-ups</p>
        <h1>Battle arena</h1>
      </div>
      {game.state !== "Connected" && (
        <Access state={game.state} retry={game.retry} />
      )}
      {error && (
        <p role="alert" className="game-error">
          {error}
        </p>
      )}
      {!room && game.state === "Connected" && (
        <section className="game-grid">
          <div className="game-card">
            <Swords />
            <h2>Host a battle</h2>
            <p>
              Share your private code with one rival. The clock starts when both
              players are ready.
            </p>
            <button
              className="game-cta"
              disabled={busy}
              onClick={() => void act("create", { kind: "battle" })}
            >
              Create room
            </button>
          </div>
          <form
            className="game-card"
            onSubmit={(e) => {
              e.preventDefault()
              void act("join", { code: code.trim().toUpperCase() })
            }}
          >
            <h2>Join a rival</h2>
            <label>
              Room code
              <input
                required
                maxLength={8}
                pattern="[a-fA-F0-9]{8}"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </label>
            <button disabled={busy}>Join room</button>
          </form>
        </section>
      )}
      {room?.kind === "solo" && (
        <div className="game-card">
          <p>Solo workout {room.phase.toLowerCase()}</p>
          <button onClick={() => void act("leave", { id: room.id })}>
            Close solo activity
          </button>
        </div>
      )}
      {room?.kind === "battle" && (
        <>
          <section className="game-card">
            <div className="stat-row">
              <span className="eyebrow">
                {room.phase} · {game.state}
              </span>
              <b>{room.code}</b>
            </div>
            {(room.phase === "COUNTDOWN" || room.phase === "ACTIVE") && (
              <div className="match-clock">
                <Timer />
                {seconds}s
              </div>
            )}
            <Avatars
              athletes={room.players.map((p) => ({
                ...p,
                pose:
                  room.phase === "COMPLETED"
                    ? p.outcome === "win"
                      ? "win"
                      : p.outcome === "loss"
                        ? "loss"
                        : "draw"
                    : room.phase === "ACTIVE"
                      ? "plank"
                      : p.ready
                        ? "ready"
                        : "idle",
              }))}
            />
            <div className="scoreboard">
              {room.players.map((p) => (
                <div key={p.id}>
                  <strong>{p.username}</strong>
                  <small>
                    {p.online
                      ? p.ready
                        ? "Ready"
                        : "In lobby"
                      : "Disconnected"}
                  </small>
                  <b>{p.score}</b>
                </div>
              ))}
            </div>
            {room.phase === "WAITING" && (
              <p>Waiting for a rival. Share the room code above.</p>
            )}
            {room.phase === "READY" && (
              <button
                className="game-cta"
                disabled={
                  busy || (me?.ready && room.players.some((p) => !p.online))
                }
                onClick={() => void act("ready", { id: room.id })}
              >
                {me?.ready ? "Ready · waiting for rival" : "Ready to battle"}
              </button>
            )}
            {room.phase === "SAVING" && <p>Saving official results…</p>}
            {room.phase === "COMPLETED" && (
              <div className="battle-result">
                <Trophy />
                <h2>
                  {room.players.find((p) => p.outcome === "win")?.username
                    ? room.players.find((p) => p.outcome === "win")!.username +
                      " wins"
                    : "Draw"}
                </h2>
                <p>
                  Your battle reward · {me?.reward?.xp ?? 0} XP ·{" "}
                  {me?.reward?.crystals ?? 0} crystals
                </p>
                <Link to="/dashboard">View progression →</Link>
              </div>
            )}
            {["COMPLETED", "WAITING", "READY"].includes(room.phase) && (
              <button
                disabled={busy}
                onClick={() => void act("leave", { id: room.id })}
              >
                {room.phase === "COMPLETED" ? "Return to lobby" : "Leave room"}
              </button>
            )}
          </section>
          {!["SAVING", "COMPLETED"].includes(room.phase) && (
            <section className="game-card">
              <h2>Camera station</h2>
              <p>
                Calibrate side-on before readying. Counting starts during the
                active round once your plank is calibrated.
              </p>
              <div className="training-video">
                <video ref={cv.videoRef} playsInline muted autoPlay />
                <canvas ref={cv.canvasRef} />
              </div>
              <p>{cv.error || cv.snapshot.feedback || cv.status}</p>
              <button onClick={cv.active ? () => cv.stop() : cv.enable}>
                {cv.active ? "Stop camera" : "Enable camera"}
              </button>
            </section>
          )}
        </>
      )}
    </Frame>
  )
}
