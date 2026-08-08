import { describe, expect, it, vi } from 'vitest'
import type { AigotokenAuthStatus } from '@shared/contracts/routes'

const authed: AigotokenAuthStatus = { state: 'authenticated', authenticated: true }
const unauthed: AigotokenAuthStatus = { state: 'signed-out', authenticated: false }

const loadGuard = async (status: AigotokenAuthStatus) => {
  vi.resetModules()
  vi.doMock('vue-router', async () => vi.importActual<typeof import('vue-router')>('vue-router'))
  const { createAigotokenAuthGuard } = await import('../../../src/renderer/src/router')
  return createAigotokenAuthGuard(async () => status)
}

describe('aigotoken auth guard', () => {
  it('redirects unauthenticated users from protected routes to login', async () => {
    const guard = await loadGuard(unauthed)
    expect(await guard({ name: 'chat' })).toEqual({ name: 'aigotoken-login' })
  })

  it('allows authenticated users through protected routes', async () => {
    const guard = await loadGuard(authed)
    expect(await guard({ name: 'chat' })).toBe(true)
  })

  it('keeps the login route public when unauthenticated', async () => {
    const guard = await loadGuard(unauthed)
    expect(await guard({ name: 'aigotoken-login' })).toBe(true)
  })
})
