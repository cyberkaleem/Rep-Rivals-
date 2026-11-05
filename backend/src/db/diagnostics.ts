// Driver errors can embed credentials, SQL and hostnames. Emit only known categories.
// Prefer the underlying cause to the generic Prisma raw-query error.
const categories: [RegExp, string][] = [
  [/\bENOTFOUND\b/i, 'DNS_ENOTFOUND'],
  [/\bEAI_AGAIN\b/i, 'DNS_EAI_AGAIN'],
  [/\bECONNREFUSED\b/i, 'CONNECTION_REFUSED'],
  [/\bECONNRESET\b/i, 'CONNECTION_RESET'],
  [/28P01|P1000|password authentication failed|AuthenticationFailed/i, 'AUTHENTICATION_FAILED'],
  [/42501|P1010|permission denied/i, 'PERMISSION_DENIED'],
  [/3D000|P1003|DatabaseDoesNotExist/i, 'DATABASE_DOES_NOT_EXIST'],
  [/P1011|TlsConnectionError|certificate|SELF_SIGNED|ERR_TLS/i, 'TLS_VERIFICATION_FAILED'],
  [/ETIMEDOUT|P1002|P2024|timed?\s?out|timeout/i, 'CONNECTION_TIMEOUT'],
  [/P1001|DatabaseNotReachable|ENETUNREACH|EHOSTUNREACH/i, 'DATABASE_UNREACHABLE'],
  [/PROBE_RESULT_INVALID/, 'PROBE_RESULT_INVALID'],
]

export function databaseDiagnostic(error: unknown): string {
  const messages: string[] = []
  function inspect(value: unknown, depth: number) {
    if (!value || typeof value !== 'object' || depth > 4) return
    const record = value as Record<string, unknown>
    for (const key of ['code', 'errorCode', 'originalCode', 'kind', 'message', 'originalMessage']) {
      if (typeof record[key] === 'string') messages.push(record[key])
    }
    for (const key of ['cause', 'meta', 'driverAdapterError']) inspect(record[key], depth + 1)
  }
  inspect(error, 0)
  const evidence = messages.join(' ')
  return categories.find(([pattern]) => pattern.test(evidence))?.[1] ?? 'DATABASE_PROBE_FAILED'
}
