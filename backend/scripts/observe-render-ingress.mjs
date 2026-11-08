// Temporary preload for the existing health-only listener. Output goes to private service logs.
import { subscribe } from 'node:diagnostics_channel'
import { isIP } from 'node:net'

const probeId = process.env.REP_RIVALS_INGRESS_PROBE_ID
if (process.env.REP_RIVALS_HEALTH_ONLY !== 'true' || !/^[a-f0-9]{32}$/.test(probeId ?? '')) {
  throw Error('Ingress observation requires explicit health-only mode and a 32-hex probe ID.')
}

let samples = 0
subscribe('http.server.request.start', ({ request }) => {
  const headers = request.headers
  if (samples >= 12 || request.method !== 'GET' || request.url !== '/api/health' ||
      headers['x-rep-rivals-probe'] !== probeId) return
  const expected = headers['x-rep-rivals-expected-ip']
  if (typeof expected !== 'string' || !isIP(expected)) return

  const chain = (headers['x-forwarded-for'] ?? '').split(',').map(ip => ip.trim()).reverse()
  const peer = request.socket.remoteAddress
  console.info('Ingress observation', JSON.stringify({
    sample: ++samples,
    socketPeer: peer && isIP(peer) ? peer : null,
    httpsOnly: headers['x-forwarded-proto'] === 'https',
    expectedClientIndexFromRight: chain.indexOf(expected),
    forwardedAddressCount: chain.filter(Boolean).length,
    forwardedContainsTestAddress: chain.includes('192.0.2.123'),
    edgeClientMatchesExpected: headers['cf-connecting-ip'] === expected,
  }))
})
