import { Capacitor, registerPlugin } from '@capacitor/core'

export interface PlayerAccount {
  id: string
  username: string
  email: string
  createdAt: string
}

export class AccountError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

type Operation = 'register' | 'login' | 'logout' | 'me'
const native = registerPlugin<{
  request(options: { operation: Operation } & Record<string, string>): Promise<{ status: number; user?: PlayerAccount }>
}>('RepRivalsAccount')

async function request(path: Operation, body?: Record<string, string>, signal?: AbortSignal): Promise<PlayerAccount | undefined> {
  if (Capacitor.getPlatform() === 'android') {
    signal?.throwIfAborted()
    const result = await native.request({ ...body, operation: path })
    signal?.throwIfAborted()
    if (result.status === 204 && path === 'logout') return
    if ((result.status === 200 || result.status === 201) && result.user) return result.user
    const errors: Record<number, string> = {
      400: 'Check the account details and try again.',
      401: path === 'login' ? 'Incorrect email or password.' : 'Please sign in.',
      409: 'This email or username is already in use.',
      429: 'Too many attempts. Try again later.',
    }
    throw new AccountError(result.status, errors[result.status] ?? 'Cannot reach the secure account service. Check your connection and retry.')
  }
  const response = await fetch('/api/auth/' + path, {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    cache: 'no-store',
    signal,
    ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  if (!response.ok) {
    const problem = await response.json().catch(() => null)
    throw new AccountError(response.status, problem?.error?.message ?? 'The account service is unavailable. Try again.')
  }
  if (response.status !== 204) return (await response.json()).user
}

export const accountApi = {
  register: (username: string, email: string, password: string) => request('register', { username, email, password }),
  login: (email: string, password: string) => request('login', { email, password }),
  logout: () => request('logout', {}),
  async me(signal: AbortSignal): Promise<PlayerAccount> {
    const user = await request('me', undefined, signal)
    if (!user) throw new AccountError(503, 'The account service is unavailable. Try again.')
    return user
  },
}
