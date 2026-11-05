export interface PlayerAccount {
  id: string
  username: string
  email: string
  createdAt: string
}

export class AccountError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

async function request(path: string, body?: Record<string, string>, signal?: AbortSignal) {
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
  return response
}

export const accountApi = {
  register: (username: string, email: string, password: string) => request('register', { username, email, password }),
  login: (email: string, password: string) => request('login', { email, password }),
  logout: () => request('logout', {}),
  async me(signal: AbortSignal): Promise<PlayerAccount> {
    const response = await request('me', undefined, signal)
    return (await response.json()).user
  },
}
