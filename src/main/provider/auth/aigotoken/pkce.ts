import crypto from 'crypto'

function base64Url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function createAigotokenState(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function createAigotokenPkcePair(): {
  codeVerifier: string
  codeChallenge: string
} {
  const codeVerifier = base64Url(crypto.randomBytes(32))
  const digest = crypto.createHash('sha256').update(codeVerifier).digest()
  return {
    codeVerifier,
    codeChallenge: base64Url(digest)
  }
}
