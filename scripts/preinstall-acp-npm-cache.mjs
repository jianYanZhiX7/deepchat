import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import crossSpawn from 'cross-spawn'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDir, '..')
const registryPath = path.join(repositoryRoot, 'resources', 'acp-registry', 'registry.json')
const cacheDir = path.join(repositoryRoot, 'resources', 'acp-npm-cache')

const resolveNpxPackage = () => {
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  const agents = Array.isArray(registry) ? registry : registry.agents
  const claude = agents.find((agent) => agent.id === 'claude-acp')
  const pkg = claude?.distribution?.npx?.package
  if (typeof pkg !== 'string' || pkg.trim() === '') {
    throw new Error('claude-acp npx package not found in ACP registry')
  }
  return pkg
}

const resolveNpmCommand = () => {
  const nodeDir = path.join(repositoryRoot, 'runtime', 'node')
  if (process.platform === 'win32') {
    const npmCmd = path.join(nodeDir, 'npm.cmd')
    if (existsSync(npmCmd)) return npmCmd
    return path.join(nodeDir, 'npm')
  }
  return path.join(nodeDir, 'bin', 'npm')
}

const runNpm = (npmCommand, args, cwd, spawn) => {
  const result = spawn(npmCommand, args, { cwd, env: process.env, stdio: 'inherit' })
  if (result.error) {
    throw new Error('Failed to start bundled npm to pre-populate ACP cache', { cause: result.error })
  }
  if (result.status !== 0) {
    const termination = result.signal ? `signal ${result.signal}` : `exit code ${result.status}`
    throw new Error(`ACP npm cache preinstall failed with ${termination}`)
  }
}

export function preinstallAcpNpmCache({
  npmCommand = resolveNpmCommand(),
  pkg = resolveNpxPackage(),
  cache = cacheDir,
  spawn = crossSpawn.sync
} = {}) {
  if (!existsSync(npmCommand)) {
    throw new Error(
      `Bundled npm not found at ${npmCommand}. Run the node runtime installer first (installRuntime:node).`
    )
  }

  rmSync(cache, { recursive: true, force: true })

  const stagingDir = mkdtempSync(path.join(tmpdir(), 'acp-npm-cache-'))
  try {
    writeFileSync(path.join(stagingDir, 'package.json'), JSON.stringify({ name: 'acp-npm-cache' }))

    runNpm(
      npmCommand,
      ['install', pkg, '--cache', cache, '--no-audit', '--no-fund', '--no-save'],
      stagingDir,
      spawn
    )

    writeFileSync(path.join(cache, '.acp-cache-marker'), pkg)
  } finally {
    rmSync(stagingDir, { recursive: true, force: true })
  }

  return { pkg, cache }
}

function main() {
  const { pkg, cache } = preinstallAcpNpmCache()
  console.log(`Pre-populated ACP npm cache for ${pkg} at ${cache}`)
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
