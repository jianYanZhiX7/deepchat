import { describe, expect, it, vi } from 'vitest'
import { AgentPresetDefinitionSchema } from '@shared/contracts/domainSchemas'
import { discoverSkillMetadataInWorker } from '../../../src/main/skill/discoveryWorker'

const loadBundledResources = async () => {
  const fs = await vi.importActual<typeof import('node:fs')>('node:fs')
  const path = await vi.importActual<typeof import('node:path')>('node:path')
  const presetsDir = path.resolve(process.cwd(), 'resources/agent-presets')
  const skillsDir = path.resolve(process.cwd(), 'resources/skills')
  const presetFiles = fs
    .readdirSync(presetsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort()
  return { fs, path, presetsDir, skillsDir, presetFiles }
}

const readPreset = (
  fs: typeof import('node:fs'),
  path: typeof import('node:path'),
  presetsDir: string,
  fileName: string
) =>
  AgentPresetDefinitionSchema.safeParse(
    JSON.parse(fs.readFileSync(path.join(presetsDir, fileName), 'utf8'))
  )

const SAFE_SKILL_NAME = /^[a-z0-9][a-z0-9._-]*$/

describe('bundled Agent presets', () => {
  it('stays schema-valid with resolvable Skills and icons', async () => {
    const { fs, path, presetsDir, skillsDir, presetFiles } = await loadBundledResources()

    expect(presetFiles.length).toBeGreaterThan(0)

    for (const fileName of presetFiles) {
      const parsed = readPreset(fs, path, presetsDir, fileName)
      expect(parsed.success, `invalid preset: ${fileName}`).toBe(true)
      if (!parsed.success) continue

      const preset = parsed.data
      expect(fileName).toBe(`${preset.id}.json`)

      for (const skillName of preset.enabledSkillNames ?? []) {
        expect(
          fs.existsSync(path.join(skillsDir, skillName, 'SKILL.md')),
          `missing bundled Skill for ${preset.id}: ${skillName}`
        ).toBe(true)
      }

      const iconFile = preset.icon?.replace(/^agentpreset:\/\//, '')
      if (iconFile) {
        expect(
          fs.existsSync(path.join(presetsDir, iconFile)),
          `missing preset icon for ${preset.id}: ${iconFile}`
        ).toBe(true)
      }
    }
  })

  it('discovers every validly-named preset-referenced Skill', async () => {
    const { fs, path, presetsDir, skillsDir, presetFiles } = await loadBundledResources()

    const referenced = new Set<string>()
    for (const fileName of presetFiles) {
      const parsed = readPreset(fs, path, presetsDir, fileName)
      if (!parsed.success) continue
      for (const skillName of parsed.data.enabledSkillNames ?? []) referenced.add(skillName)
    }

    const result = await discoverSkillMetadataInWorker({
      skillsDir,
      sidecarDirName: '.deepchat-meta',
      maxDepth: 10
    })
    const discovered = new Set(result.skills.map((skill) => skill.name))
    const undiscovered = [...referenced].filter((name) => !discovered.has(name))
    const invalidNames = [...referenced].filter((name) => !SAFE_SKILL_NAME.test(name))

    expect(undiscovered).toEqual(invalidNames)
  })
})
