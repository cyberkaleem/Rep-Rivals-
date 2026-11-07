// Opt-in workaround for development machines whose OS resolver refuses Neon.
// Only the two Console-verified public DNS names are sent to the resolver.
import dns from 'node:dns'
import { isIPv4 } from 'node:net'

let installed = false
export function enableDevelopmentDns(hosts) {
  if (installed) return
  installed = true
  const system = dns.lookup.bind(dns)
  const cached = new Map()
  async function addresses(name) {
    const previous = cached.get(name)
    if (previous && previous.until > Date.now()) return previous.rows
    const response = await fetch('https://dns.google/resolve?type=A&name=' + encodeURIComponent(name),
      { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw Error('Development DNS lookup failed')
    const answer = await response.json()
    const records = (answer.Answer ?? []).filter(row => row.type === 1 && isIPv4(row.data))
    if (answer.Status !== 0 || !records.length) throw Error('Development DNS returned no addresses')
    const rows = records.map(row => ({ address: row.data, family: 4 }))
    cached.set(name, { rows, until: Date.now() + 1000 * Math.min(60, ...records.map(r => r.TTL)) })
    return rows
  }
  dns.lookup = function (name, options, callback) {
    if (!hosts.includes(name)) return system(...arguments)
    if (typeof options === 'function') { callback = options; options = {} }
    system(name, options, (error, address, family) => {
      if (!error || !['ENOTFOUND', 'EAI_AGAIN', 'EREFUSED'].includes(error.code) || options?.family === 6) {
        callback(error, address, family)
        return
      }
      addresses(name).then(rows => options?.all ? callback(null, rows) : callback(null, rows[0].address, 4),
        () => callback(error))
    })
  }
}
