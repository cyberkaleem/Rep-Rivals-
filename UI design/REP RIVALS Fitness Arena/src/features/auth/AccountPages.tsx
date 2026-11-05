import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AccountError, accountApi, type PlayerAccount } from './api'
import './account.css'

function AccountLayout({ children }: { children: ReactNode }) {
  return <main className="training-page">
    <header className="training-header">
      <Link to="/" className="training-brand">REP <b>RIVALS</b></Link>
      <Link to="/" className="training-back">Back to home</Link>
    </header>
    <section className="account-panel">{children}</section>
  </main>
}

const message = (error: unknown) => error instanceof AccountError ? error.message : 'Unable to reach the account service. Try again.'

export function AuthForm({ register = false }: { register?: boolean }) {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    const email = String(form.get('email'))
    setError('')
    if (register && password !== form.get('confirmation')) { setError('The passwords must match.'); return }
    setBusy(true)
    try {
      if (register) await accountApi.register(String(form.get('username')), email, password)
      else await accountApi.login(email, password)
      navigate('/account', { replace: true })
    } catch (error) { setError(message(error)) }
    finally { setBusy(false) }
  }
  return <AccountLayout>
    <h1>{register ? 'Create an account' : 'Log in'}</h1>
    <form onSubmit={submit}>
      {register && <label>Username<input required name="username" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" aria-describedby="username-hint" /><small id="username-hint">3–24 letters, numbers or underscores.</small></label>}
      <label>Email<input required name="email" type="email" autoComplete={register ? 'email' : 'username'} maxLength={254} /></label>
      <label>Password<input required name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 15 : 1} maxLength={128} aria-describedby={register ? 'password-hint' : undefined} />{register && <small id="password-hint">Use 15–128 characters.</small>}</label>
      {register && <label>Confirm password<input required name="confirmation" type="password" autoComplete="new-password" maxLength={128} /></label>}
      {error && <p role="alert">{error}</p>}
      <button className="account-action" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Log in'}</button>
    </form>
    <Link to={register ? '/login' : '/register'}>{register ? 'Already registered? Log in' : 'Create an account'}</Link>
  </AccountLayout>
}

export function AccountPage() {
  const navigate = useNavigate()
  const [player, setPlayer] = useState<PlayerAccount | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    accountApi.me(controller.signal).then(account => {
      if (!controller.signal.aborted) setPlayer(account)
    }).catch(failure => {
      if (controller.signal.aborted) return
      if (failure instanceof AccountError && failure.status === 401) navigate('/login', { replace: true })
      else setError(message(failure))
    })
    return () => controller.abort()
  }, [navigate, attempt])
  async function logout() {
    setBusy(true)
    try { await accountApi.logout(); navigate('/login', { replace: true }) }
    catch (failure) { setError(message(failure)); setBusy(false) }
  }
  return <AccountLayout>
    <h1>Player account</h1>
    {error && <p role="alert">{error}</p>}
    {player ? <>
      <dl><dt>Username</dt><dd>{player.username}</dd><dt>Email</dt><dd>{player.email}</dd></dl>
      <Link className="account-action" to="/training">Start solo training</Link>
      <button onClick={logout} disabled={busy}>{busy ? 'Logging out…' : 'Log out'}</button>
    </> : error ? <button onClick={() => setAttempt(attempt + 1)}>Retry</button> : <p role="status">Checking session…</p>}
  </AccountLayout>
}
