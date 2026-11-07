import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { X509Certificate } from 'node:crypto'

export const tlsDirectory = fileURLToPath(new URL('../../.tools/android-auth-tls/', import.meta.url))
export const certificate = join(tlsDirectory, 'server.pem')
export const authority = join(tlsDirectory, 'res/raw/rep_rivals_dev_ca.pem')
export const privateKey = join(tlsDirectory, 'server.key')

export function prepareTls() {
  if ([certificate, authority, privateKey].every(existsSync)) {
    if (Date.parse(new X509Certificate(readFileSync(certificate)).validTo) <= Date.now() + 86400000) {
      throw Error('Development certificate expires soon. Move the old android-auth-tls directory aside, regenerate and rebuild the debug APK.')
    }
    return
  }
  if (existsSync(tlsDirectory)) throw Error('Incomplete TLS directory. Move it aside before generating a new pair.')
  const parent = dirname(tlsDirectory.replace(/[\\/]$/, ''))
  mkdirSync(parent, { recursive: true })
  const temp = mkdtempSync(join(parent, 'new-android-auth-'))
  const windowsOpenSSL = 'C:/Program Files/Git/usr/bin/openssl.exe'
  const openssl = process.env.OPENSSL_EXE || (existsSync(windowsOpenSSL) ? windowsOpenSSL : 'openssl')
  const run = (...args) => execFileSync(openssl, args, { cwd: temp, stdio: 'ignore', windowsHide: true })
  try {
    mkdirSync(join(temp, 'res/raw'), { recursive: true })
    run('req','-x509','-newkey','rsa:3072','-nodes','-sha256','-days','30','-subj','/CN=REP RIVALS local debug CA',
      '-addext','basicConstraints=critical,CA:TRUE,pathlen:0','-addext','keyUsage=critical,keyCertSign,cRLSign',
      '-keyout','ca.key','-out','res/raw/rep_rivals_dev_ca.pem')
    run('req','-new','-newkey','rsa:2048','-nodes','-subj','/CN=REP RIVALS loopback','-keyout','server.key','-out','server.csr')
    writeFileSync(join(temp,'server.ext'), 'subjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\nkeyUsage=critical,digitalSignature,keyEncipherment\n')
    run('x509','-req','-in','server.csr','-CA','res/raw/rep_rivals_dev_ca.pem','-CAkey','ca.key',
      '-set_serial','1','-days','14','-sha256','-extfile','server.ext','-out','server.pem')
    for (const name of ['ca.key','server.csr','server.ext']) rmSync(join(temp, name))
    renameSync(temp, tlsDirectory)
  } finally {
    if (existsSync(temp)) rmSync(temp, { recursive: true, force: true })
  }
}
