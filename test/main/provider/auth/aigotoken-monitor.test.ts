import { afterEach, describe, expect, it, vi } from 'vitest'
import { AigotokenModelMonitor } from '@/provider/auth/aigotoken/monitor'

const INTERVAL_MS = 30 * 60 * 1000

function makeMonitor(syncModels: ReturnType<typeof vi.fn>) {
  return new AigotokenModelMonitor(
    {
      syncModels,
      isAuthenticated: () => true
    },
    INTERVAL_MS,
    () => false
  )
}

describe('AigotokenModelMonitor', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('syncs immediately on start', () => {
    const syncModels = vi.fn().mockResolvedValue(false)
    const monitor = makeMonitor(syncModels)

    monitor.start()
    expect(syncModels).toHaveBeenCalledTimes(1)

    monitor.stop()
  })

  it('syncs again after the configured interval', async () => {
    vi.useFakeTimers()
    const syncModels = vi.fn().mockResolvedValue(false)
    const monitor = makeMonitor(syncModels)

    monitor.start()
    expect(syncModels).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(INTERVAL_MS)
    expect(syncModels).toHaveBeenCalledTimes(2)

    monitor.stop()
  })
})
