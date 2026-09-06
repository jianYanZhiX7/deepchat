import { reactive } from 'vue'

const FLASH_DURATION_MS = 6000

const normalizeFsPath = (value: string): string => {
  return value.trim().replace(/\\/g, '/').replace(/\/+$/, '')
}

const flashingPaths = reactive(new Set<string>())
const pruneTimers = new Map<string, ReturnType<typeof setTimeout>>()

export const flashFiles = (paths: readonly string[]): void => {
  for (const rawPath of paths) {
    const filePath = normalizeFsPath(rawPath)
    if (!filePath) {
      continue
    }

    flashingPaths.add(filePath)

    const existingTimer = pruneTimers.get(filePath)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }
    pruneTimers.set(
      filePath,
      setTimeout(() => {
        flashingPaths.delete(filePath)
        pruneTimers.delete(filePath)
      }, FLASH_DURATION_MS)
    )
  }
}

export const isFileFlashing = (filePath: string): boolean => {
  return flashingPaths.has(normalizeFsPath(filePath))
}
