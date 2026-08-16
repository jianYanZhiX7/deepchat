import logger from '@shared/logger'

export type AigotokenMonitorPort = {
  syncModels(): Promise<boolean>
  isAuthenticated(): boolean
}

export class AigotokenModelMonitor {
  private timer: ReturnType<typeof setInterval> | null = null
  private inFlight: Promise<void> | null = null

  constructor(
    private readonly port: AigotokenMonitorPort,
    private readonly intervalMs: number,
    private readonly isPrivacyModeEnabled: () => boolean
  ) {}

  start(): void {
    if (this.timer) {
      return
    }

    this.timer = setInterval(() => {
      void this.tick()
    }, this.intervalMs)

    logger.info(
      `[AigotokenModelMonitor] started with interval ${this.intervalMs}ms`
    )
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private async tick(): Promise<void> {
    if (this.inFlight) {
      return this.inFlight
    }

    if (this.isPrivacyModeEnabled()) {
      return
    }

    if (!this.port.isAuthenticated()) {
      return
    }

    const promise = this.runSync()
    this.inFlight = promise
    try {
      await promise
    } finally {
      if (this.inFlight === promise) {
        this.inFlight = null
      }
    }
  }

  private async runSync(): Promise<void> {
    try {
      const changed = await this.port.syncModels()
      if (changed) {
        logger.info('[AigotokenModelMonitor] detected model changes')
      }
    } catch (error) {
      logger.warn('[AigotokenModelMonitor] sync failed:', error)
    }
  }
}
