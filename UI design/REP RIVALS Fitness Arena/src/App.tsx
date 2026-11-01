import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import heroImage from './assets/rep-rivals-hero.jpg'

type Screen = 'home' | 'dashboard' | 'lobby' | 'countdown' | 'battle' | 'results'

const Icon = ({ name, size = 20 }: { name: string; size?: number }) => {
  const paths: Record<string, React.ReactNode> = {
    bolt: <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></>,
    play: <path d="m9 7 8 5-8 5V7Z" />,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M12 13v4M8 20h8M9 17h6" /></>,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    camera: <><path d="M4 7h3l2-3h6l2 3h3v12H4V7Z" /><circle cx="12" cy="13" r="4" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    gem: <path d="m12 2 8 6-8 14L4 8l8-6Zm-8 6h16M8 8l4 14 4-14M8 8l4-6 4 6" />,
    flame: <path d="M12 22c4 0 7-3 7-7 0-3-2-5-4-7 0 3-2 4-3 5 0-5-2-8-5-11 0 5-3 7-3 12 0 5 3 8 8 8Z" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6l4 2" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">{paths[name]}</svg>
}

function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button className="logo" onClick={onClick} aria-label="Rep Rivals home">
      <span className="logo-mark"><i /><i /><i /></span>
      <span>REP <b>RIVALS</b></span>
    </button>
  )
}

function Header({ screen, go }: { screen: Screen; go: (s: Screen) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <header className={`header ${screen !== 'home' ? 'header-solid' : ''}`}>
      <Logo onClick={() => go('home')} />
      <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle menu"><Icon name={open ? 'close' : 'menu'} /></button>
      <nav className={open ? 'open' : ''}>
        <button onClick={() => { go('home'); setOpen(false) }}>The game</button>
        <button onClick={() => { go('dashboard'); setOpen(false) }}>Command center</button>
        <button onClick={() => { go('lobby'); setOpen(false) }}>Battle arena</button>
        <button onClick={() => { go('dashboard'); setOpen(false) }}>Ranks</button>
      </nav>
      <button className="header-cta" onClick={() => go('dashboard')}>ENTER ARENA <Icon name="arrow" size={16} /></button>
    </header>
  )
}

const EmberButton = ({ children, onClick, secondary = false, disabled = false }: { children: React.ReactNode; onClick?: () => void; secondary?: boolean; disabled?: boolean }) => (
  <button className={`action-button ${secondary ? 'secondary' : ''}`} onClick={onClick} disabled={disabled}><span>{children}</span><Icon name="arrow" size={18} /></button>
)

function Home({ go }: { go: (s: Screen) => void }) {
  return (
    <main>
      <section className="hero">
        <img src={heroImage} alt="Strength athlete deadlifting in a cinematic industrial gym" />
        <div className="hero-vignette" />
        <div className="hero-grid" />
        <div className="hero-content">
          <div className="eyebrow"><span /> THE NEXT EVOLUTION OF FITNESS</div>
          <h1>YOUR BODY<br />IS THE <em>CONTROLLER.</em></h1>
          <p>Turn every rep into progress. Challenge real rivals.<br className="desktop-only" /> Rise through the ranks.</p>
          <div className="hero-actions">
            <EmberButton onClick={() => go('dashboard')}>ENTER THE ARENA</EmberButton>
            <EmberButton secondary onClick={() => document.querySelector('#system')?.scrollIntoView({ behavior: 'smooth' })}>EXPLORE THE GAME</EmberButton>
          </div>
        </div>
        <div className="hero-status">
          <span><i className="status-dot" /> ARENA ONLINE</span>
          <strong>12,804</strong>
          <small>ATHLETES ACTIVE</small>
        </div>
        <div className="scroll-cue"><span>SCROLL TO ENGAGE</span><i /></div>
      </section>

      <section className="manifesto" id="system">
        <div className="section-index">01 / THE SYSTEM</div>
        <div>
          <p className="kicker">BUILT FOR THE RELENTLESS</p>
          <h2>NO CONTROLLERS.<br />NO SHORTCUTS.<br /><em>JUST REPS.</em></h2>
        </div>
        <div className="manifesto-copy">
          <p>REP RIVALS transforms physical effort into competitive power. Your movement drives the game. Every clean rep builds your legacy.</p>
          <div className="system-stats">
            <span><b>06</b> RANK DIVISIONS</span>
            <span><b>08</b> TRACKED MOVEMENTS</span>
            <span><b>∞</b> RIVALRIES</span>
          </div>
        </div>
      </section>

      <section className="features">
        {[
          ['01', 'camera', 'MOVE', 'Camera-ready training', 'A precision interface prepared for pose tracking. Calibration and rep detection are shown as prototype states until a vision engine is connected.'],
          ['02', 'users', 'COMPETE', 'Real-time battle simulation', 'Enter side-by-side arenas, race the clock, and feel every lead change through an immersive multiplayer-ready interface.'],
          ['03', 'trophy', 'ASCEND', 'Earn your position', 'Stack XP, claim crystals, and progress from Rookie to Legend. Status here is earned through disciplined work.'],
        ].map(([n, icon, label, title, copy]) => (
          <article className="feature-card" key={n}>
            <span className="feature-number">{n}</span>
            <div className="feature-icon"><Icon name={icon} size={28} /></div>
            <p className="kicker">{label}</p>
            <h3>{title}</h3>
            <p>{copy}</p>
            <span className="hairline" />
          </article>
        ))}
      </section>

      <section className="battle-promo">
        <div className="battle-image"><img src={heroImage} alt="" /><div /></div>
        <div className="battle-copy">
          <p className="kicker">LIVE FITNESS BATTLES</p>
          <h2>PRESSURE<br />MAKES <em>POWER.</em></h2>
          <p>One exercise. One clock. Two athletes. Enter a private arena and let the reps decide who owns the floor.</p>
          <ul>
            <li><Icon name="check" /> PRIVATE CAMERA BY DESIGN</li>
            <li><Icon name="check" /> LIVE SCORE SIMULATION</li>
            <li><Icon name="check" /> RANKED PROGRESSION</li>
          </ul>
          <EmberButton onClick={() => go('lobby')}>VIEW BATTLE PROTOTYPE</EmberButton>
        </div>
      </section>

      <section className="rank-strip">
        <div><p className="kicker">YOUR LEGACY STARTS AT ZERO</p><h2>RISE THROUGH<br />THE <em>RANKS.</em></h2></div>
        <div className="ranks">
          {['ROOKIE', 'CHALLENGER', 'WARRIOR', 'ELITE', 'TITAN', 'LEGEND'].map((rank, i) => (
            <div className={i === 3 ? 'active' : ''} key={rank}><span className={`rank-badge r${i}`}><Icon name={i > 3 ? 'flame' : 'shield'} size={26} /></span><small>0{i + 1}</small><b>{rank}</b></div>
          ))}
        </div>
      </section>
      <section className="final-cta"><div className="final-bg" style={{ backgroundImage: `url(${heroImage})` }} /><p className="kicker">THE ARENA IS WAITING</p><h2>PROVE IT<br /><em>ONE REP AT A TIME.</em></h2><EmberButton onClick={() => go('dashboard')}>START YOUR RISE</EmberButton></section>
      <footer><Logo onClick={() => go('home')} /><p>REAL REPS. REAL RIVALS. REAL POWER.</p><span>PROTOTYPE EXPERIENCE / 2025</span></footer>
    </main>
  )
}

function RankBadge({ label = 'ROOKIE' }: { label?: string }) {
  return <div className="identity-rank"><span><Icon name="shield" size={24} /></span><div><small>CURRENT RANK</small><b>{label}</b></div></div>
}

function Dashboard({ go }: { go: (s: Screen) => void }) {
  const navigate = useNavigate()
  return (
    <main className="app-shell dashboard">
      <section className="dash-top">
        <div><p className="kicker">COMMAND CENTER / PLAYER 0847</p><h1>WELCOME BACK,<br /><em>IRONWOLF.</em></h1></div>
        <div className="wallet"><Icon name="gem" /><span><small>CRYSTAL BALANCE</small><b>2,480</b></span><button>+</button></div>
      </section>
      <section className="dash-grid">
        <article className="player-card">
          <img src={heroImage} alt="Ironwolf athlete profile" />
          <div className="scanline" />
          <div className="player-overlay">
            <span className="prototype-tag">AVATAR PREVIEW</span>
            <RankBadge />
            <div className="level"><span>LEVEL 08</span><b>6,840 <small>/ 10,000 XP</small></b><div><i /></div></div>
          </div>
        </article>
        <div className="dash-actions">
          <button className="battle-action" onClick={() => go('lobby')}><div><p className="kicker">RANKED / PUSH-UPS</p><h2>ENTER<br />BATTLE</h2><span>FIND YOUR NEXT RIVAL <Icon name="arrow" /></span></div><Icon name="users" size={62} /></button>
          <div className="sub-actions">
            <button onClick={() => navigate('/training')}><Icon name="target" /><span><small>REAL CAMERA</small><b>SOLO TRAINING</b></span><Icon name="chevron" /></button>
            <button><Icon name="flame" /><span><small>3 REMAINING</small><b>DAILY ORDERS</b></span><Icon name="chevron" /></button>
          </div>
        </div>
        <article className="daily-panel panel">
          <div className="panel-title"><span><Icon name="bolt" /> TODAY'S ORDER</span><small>ENDS 08:42:19</small></div>
          <div className="order-ring"><div><b>74</b><span>/ 100</span></div></div>
          <div><p className="kicker">FORGED BY VOLUME</p><h3>COMPLETE 100<br />PUSH-UPS</h3><p>26 reps remain to secure <b>+450 XP</b> and <b>+80 crystals</b>.</p></div>
        </article>
        <article className="record-panel panel">
          <div className="panel-title"><span>COMBAT RECORD</span><button>VIEW ALL</button></div>
          <div className="record-numbers"><div><b>14</b><small>WINS</small></div><div><b>06</b><small>LOSSES</small></div><div><b>70<em>%</em></b><small>WIN RATE</small></div></div>
          <div className="match-row"><span className="win">W</span><div><b>VS / NOVA_K</b><small>PUSH-UPS · 2:00</small></div><strong>42 <i>—</i> 37</strong></div>
          <div className="match-row"><span className="loss">L</span><div><b>VS / GRIT_91</b><small>SQUATS · 3:00</small></div><strong>55 <i>—</i> 61</strong></div>
        </article>
      </section>
    </main>
  )
}

function Lobby({ go }: { go: (s: Screen) => void }) {
  const [duration, setDuration] = useState(60)
  const [ready, setReady] = useState(false)
  return (
    <main className="app-shell lobby">
      <div className="lobby-head"><div><p className="kicker">PRIVATE ARENA / ROOM R7X9</p><h1>BATTLE <em>LOBBY.</em></h1></div><span className="prototype-tag">SIMULATED MATCH</span></div>
      <section className="versus">
        <div className="fighter player-one"><img src={heroImage} alt="" /><div><RankBadge /><h2>IRONWOLF</h2><p>LEVEL 08 · RECORD 14–6</p></div></div>
        <div className="vs-mark"><small>HEAD TO HEAD</small><b>VS</b><span>ROOM R7X9</span></div>
        <div className="fighter player-two"><img src={heroImage} alt="" /><div><RankBadge label="CHALLENGER" /><h2>NOVA_K</h2><p>LEVEL 11 · RECORD 22–9</p></div></div>
      </section>
      <section className="match-settings">
        <div className="setting"><small>01 / EXERCISE</small><div className="selected-setting"><Icon name="flame" /><span><b>PUSH-UPS</b><em>CAMERA TRACKING READY*</em></span><Icon name="chevron" /></div></div>
        <div className="setting"><small>02 / DURATION</small><div className="duration-tabs">{[60, 90, 120].map(v => <button className={duration === v ? 'active' : ''} onClick={() => setDuration(v)} key={v}><b>{v}</b><span>SEC</span></button>)}</div></div>
        <div className="setting calibration"><small>03 / CAMERA CHECK</small><div><span className="camera-box"><Icon name="camera" size={30} /><i>PREVIEW DISABLED</i></span><span><b>PROTOTYPE CALIBRATION</b><p>No live camera or pose detection is connected. The match will use generated rep events.</p></span></div></div>
      </section>
      <div className="ready-bar">
        <button className={`ready-toggle ${ready ? 'active' : ''}`} onClick={() => setReady(!ready)}><span><Icon name="check" /></span><b>{ready ? 'READY FOR BATTLE' : 'MARK YOURSELF READY'}</b></button>
        <EmberButton onClick={() => go('countdown')} disabled={!ready}>BEGIN SIMULATION</EmberButton>
      </div>
    </main>
  )
}

function Countdown({ go }: { go: (s: Screen) => void }) {
  const [count, setCount] = useState(3)
  useEffect(() => {
    const timer = window.setInterval(() => setCount(v => {
      if (v <= 1) { window.clearInterval(timer); window.setTimeout(() => go('battle'), 650); return 0 }
      return v - 1
    }), 900)
    return () => window.clearInterval(timer)
  }, [go])
  return <main className="countdown-screen" style={{ backgroundImage: `url(${heroImage})` }}><div className="countdown-overlay" /><p>NEXT EVENT</p><h1 key={count}>{count || 'GO'}</h1><span>PUSH-UPS / 60 SECONDS</span></main>
}

function Battle({ go }: { go: (s: Screen) => void }) {
  const [time, setTime] = useState(60)
  const [mine, setMine] = useState(0)
  const [theirs, setTheirs] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const tick = window.setInterval(() => setTime(v => {
      if (v <= 1) { window.clearInterval(tick); window.setTimeout(() => go('results'), 500); return 0 }
      return v - 1
    }), 1000)
    const me = window.setInterval(() => setMine(v => v + 1), 1750)
    const rival = window.setInterval(() => setTheirs(v => v + 1), 1980)
    return () => { window.clearInterval(tick); window.clearInterval(me); window.clearInterval(rival) }
  }, [paused, go])
  const fmt = `00:${time.toString().padStart(2, '0')}`
  return (
    <main className="live-battle">
      <div className="battle-topbar"><span className="live-pill"><i /> LIVE SIMULATION</span><div><small>TIME REMAINING</small><b>{fmt}</b></div><button onClick={() => setPaused(!paused)}>{paused ? 'RESUME' : 'PAUSE'}</button></div>
      <section className="competitors">
        <div className={`competitor mine ${mine >= theirs ? 'leading' : ''}`}><img src={heroImage} alt="" /><div className="competitor-shade" /><div className="competitor-id"><RankBadge /><h2>IRONWOLF</h2></div><div className="rep-count"><small>VALID REPS</small><b key={mine}>{mine}</b><span><i style={{ width: `${Math.min(mine / 30 * 100, 100)}%` }} /></span></div></div>
        <div className="center-line"><span>{mine >= theirs ? 'LEADING' : 'PUSH'}</span><b>VS</b><i /></div>
        <div className={`competitor rival ${theirs > mine ? 'leading' : ''}`}><img src={heroImage} alt="" /><div className="competitor-shade" /><div className="competitor-id"><RankBadge label="CHALLENGER" /><h2>NOVA_K</h2></div><div className="rep-count"><small>VALID REPS</small><b key={theirs}>{theirs}</b><span><i style={{ width: `${Math.min(theirs / 30 * 100, 100)}%` }} /></span></div></div>
      </section>
      <div className="tracking-bar"><div className="camera-box"><Icon name="camera" /><span>LOCAL CAMERA<br /><b>NOT CONNECTED</b></span></div><div className="form-status"><span><i /><b>SIMULATED REP FEED</b></span><p>Generated events are driving this demo. No body or form analysis is active.</p></div><div className="phase"><small>MOVEMENT PHASE</small><b>{paused ? 'PAUSED' : mine % 2 ? 'LOWERING' : 'LOCKOUT'}</b></div></div>
    </main>
  )
}

function Results({ go }: { go: (s: Screen) => void }) {
  const rewards = useMemo(() => ({ xp: 780, crystals: 120 }), [])
  return (
    <main className="results" style={{ backgroundImage: `url(${heroImage})` }}>
      <div className="results-overlay" />
      <div className="victory">
        <p className="kicker">MATCH COMPLETE / RANKED SIMULATION</p><h1>VICTORY<span>.</span></h1><p>DISCIPLINE HELD. PRESSURE ANSWERED.</p>
        <div className="final-score"><div><small>IRONWOLF</small><b>34</b></div><span>FINAL<br />SCORE</span><div><small>NOVA_K</small><b>30</b></div></div>
        <div className="reward-row"><div><Icon name="bolt" /><span><small>XP EARNED</small><b>+{rewards.xp}</b></span></div><div><Icon name="gem" /><span><small>CRYSTALS</small><b>+{rewards.crystals}</b></span></div><div><Icon name="trophy" /><span><small>WIN STREAK</small><b>04</b></span></div></div>
        <div className="xp-result"><span><b>ROOKIE III</b><small>7,620 / 10,000 XP</small></span><div><i /></div></div>
        <div className="result-actions"><EmberButton onClick={() => go('countdown')}>REMATCH</EmberButton><EmberButton secondary onClick={() => go('dashboard')}>COMMAND CENTER</EmberButton></div>
      </div>
    </main>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const go = (next: Screen) => { setScreen(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  return (
    <div className="site">
      {!['countdown', 'battle', 'results'].includes(screen) && <Header screen={screen} go={go} />}
      {screen === 'home' && <Home go={go} />}
      {screen === 'dashboard' && <Dashboard go={go} />}
      {screen === 'lobby' && <Lobby go={go} />}
      {screen === 'countdown' && <Countdown go={go} />}
      {screen === 'battle' && <Battle go={go} />}
      {screen === 'results' && <Results go={go} />}
    </div>
  )
}
