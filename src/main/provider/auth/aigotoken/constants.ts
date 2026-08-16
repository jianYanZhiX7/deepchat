function getNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function getPortEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value >= 1 && value <= 65535 ? value : fallback
}

export const AIGOTOKEN_CLIENT_ID = 'deepchat'

export const AIGOTOKEN_HOST = 'https://www.aigotoken.com'

export const AIGOTOKEN_AUTHORIZE_URL = `${AIGOTOKEN_HOST}/oauth/authorize`

export const AIGOTOKEN_TOKEN_URL = `${AIGOTOKEN_HOST}/api/oauth/token`

export const AIGOTOKEN_MODELS_URL = `${AIGOTOKEN_HOST}/v1/models`

export const AIGOTOKEN_REDIRECT_PORT = getPortEnv('AIGOTOKEN_REDIRECT_PORT', 1456)

export const AIGOTOKEN_REDIRECT_PATH = '/oauth/aigotoken/callback'

export const AIGOTOKEN_REDIRECT_URI =
  process.env.AIGOTOKEN_REDIRECT_URI?.trim() ||
  `http://localhost:${AIGOTOKEN_REDIRECT_PORT}${AIGOTOKEN_REDIRECT_PATH}`

export const AIGOTOKEN_BROWSER_TIMEOUT_MS = getNumberEnv(
  'AIGOTOKEN_BROWSER_TIMEOUT_MS',
  10 * 60 * 1000
)

export const AIGOTOKEN_REQUEST_TIMEOUT_MS = getNumberEnv('AIGOTOKEN_REQUEST_TIMEOUT_MS', 10 * 1000)

export const AIGOTOKEN_MODELS_REFRESH_INTERVAL_MS = getNumberEnv(
  'AIGOTOKEN_MODELS_REFRESH_INTERVAL_MS',
  30 * 60 * 1000
)
