import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import logger from '@shared/logger'
import { AgentPresetDefinitionSchema } from '@shared/contracts/domainSchemas'
import type { AgentPresetDefinition } from '@shared/types/agent-interface'

const AGENT_PRESETS_DIR_NAME = 'agent-presets'

const resolveAgentPresetDirCandidates = (): string[] => {
  if (!app.isPackaged) {
    return [path.join(app.getAppPath(), 'resources', AGENT_PRESETS_DIR_NAME)]
  }
  return [
    path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', AGENT_PRESETS_DIR_NAME),
    path.join(process.resourcesPath, 'resources', AGENT_PRESETS_DIR_NAME),
    path.join(process.resourcesPath, AGENT_PRESETS_DIR_NAME)
  ]
}

const resolveAgentPresetDir = (): string | null => {
  for (const candidate of resolveAgentPresetDirCandidates()) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

const parseAgentPresetFile = (filePath: string): AgentPresetDefinition | null => {
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    logger.warn(`[AgentPresets] Failed to read preset file: ${filePath}`, { error })
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    logger.warn(`[AgentPresets] Skipping invalid JSON preset file: ${filePath}`)
    return null
  }

  const result = AgentPresetDefinitionSchema.safeParse(parsed)
  if (!result.success) {
    logger.warn(`[AgentPresets] Skipping malformed preset file: ${filePath}`, {
      issues: result.error.issues
    })
    return null
  }
  return result.data
}

export const loadAgentPresetDefinitions = (): AgentPresetDefinition[] => {
  const dir = resolveAgentPresetDir()
  if (!dir) return []

  let entries: string[]
  try {
    entries = fs.readdirSync(dir)
  } catch (error) {
    logger.warn(`[AgentPresets] Failed to list preset directory: ${dir}`, { error })
    return []
  }

  const presets: AgentPresetDefinition[] = []
  for (const entry of entries.sort()) {
    if (!entry.endsWith('.json')) continue
    const preset = parseAgentPresetFile(path.join(dir, entry))
    if (preset) presets.push(preset)
  }
  return presets
}
