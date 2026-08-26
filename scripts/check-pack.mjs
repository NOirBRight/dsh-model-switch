import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { cp, lstat, mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { load } from 'js-yaml'
import { applyEntryPatches, entryListSchema } from '@deepseek-ai/cordis-plugin-include'

const sourceRoot = resolve(process.cwd())
const forbiddenSegments = new Set(['src', 'test', 'tests', '__tests__', 'scripts', 'core', 'fork-only'])
const forbiddenExtension = /(?:\.map|\.patch|\.diff)$/
const protocolReference = /(?:file|link|workspace):/
const privateContractReference = /EXTERNAL_PLAN_HANDOFF_SENTINEL|conversation\.composer\.plan-review\.execution-model|setApprovalPreparation|PlanReviewExecutionModelAdapter|(?:plan\.(?:prepare|commit))/
const corePathReference = /(?:^|[\/@])core(?:[\/]|$)/i
const textArtifact = /\.(?:[cm]?js|d\.[cm]?ts|json|md|ya?ml|css)$/

function run(command, args, cwd) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, CI: '1', TZ: 'UTC', LANG: 'C', LC_ALL: 'C', SOURCE_DATE_EPOCH: '0', FORCE_COLOR: '0', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += String(chunk) })
    child.stderr.on('data', (chunk) => { stderr += String(chunk) })
    child.on('error', reject)
    child.on('close', (code, signal) => code === 0 ? resolveRun(stdout) : reject(new Error(command + ' failed (' + String(code ?? signal) + ')\n' + stdout + '\n' + stderr)))
  })
}

async function filesUnder(root) {
  const output = []
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name)
      const path = relative(root, absolute).split(sep).join('/')
      if (entry.isSymbolicLink()) throw new Error('packed artifact contains symlink: ' + path)
      if (entry.isDirectory()) await visit(absolute)
      else if (entry.isFile()) output.push({ path, absolute })
      else throw new Error('packed artifact contains non-regular entry: ' + path)
    }
  }
  await visit(root)
  return output.sort((a, b) => a.path.localeCompare(b.path))
}

async function inventory(root) {
  const result = []
  for (const file of await filesUnder(root)) {
    const bytes = await readFile(file.absolute)
    const stat = await lstat(file.absolute)
    result.push({ path: file.path, mode: stat.mode & 0o111, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  return result
}

function clientFactoryRequire() {
  const dummy = new Proxy(function pluginPeer() {}, {
    get(_target, prop) {
      if (prop === '__esModule') return true
      if (prop === 'then') return undefined
      if (prop === 'default') return dummy
      return dummy
    },
    apply() { return null },
    construct() { return dummy },
  })
  return () => dummy
}

function collectExportTargets(exportsValue) {
  const targets = []
  function walk(value, subpath, condition) {
    if (typeof value === 'string') { targets.push({ subpath, condition, target: value }); return }
    if (value === null) return
    if (Array.isArray(value)) throw new Error('export arrays are not supported')
    if (typeof value !== 'object') throw new Error('invalid exports entry for ' + subpath)
    const keys = Object.keys(value)
    const subpaths = keys.filter((key) => key === '.' || key.startsWith('./'))
    if (subpaths.length > 0 && subpaths.length !== keys.length) throw new Error('mixed subpath and condition exports')
    for (const key of keys) {
      if (key.includes('*')) throw new Error('wildcard exports are not supported')
      walk(value[key], subpaths.length > 0 ? key : subpath, subpaths.length > 0 ? 'default' : key)
    }
  }
  walk(exportsValue, '.', 'default')
  return targets
}

async function linkRuntimeDependencies(nodeModulesRoot, manifest) {
  const names = new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})])
  for (const name of names) {
    const source = join(sourceRoot, 'node_modules', ...name.split('/'))
    await realpath(source).catch(() => { throw new Error('runtime dependency is not installed for pack verification: ' + name) })
    const target = join(nodeModulesRoot, ...name.split('/'))
    await mkdir(dirname(target), { recursive: true })
    await symlink(source, target, 'dir').catch((error) => { if (error?.code !== 'EEXIST') throw error })
  }
}

async function verifyPresetReplacement(packageRoot) {
  const patches = load(await readFile(join(packageRoot, 'cordis.patch.yml'), 'utf8'), { schema: entryListSchema })
  const warnings = []
  const composed = applyEntryPatches(
    [
      { id: 'subagent', name: '@deepseek-ai/dsh-subagent' },
    ],
    patches, message => warnings.push(message),
  )
  if (warnings.length) throw new Error('preset patch warnings: ' + warnings.join('; '))
  const originalSubagent = composed.find(row => row.id === 'subagent')
  const replacementSubagent = composed.find(row => row.id === 'model-switch-subagent-runtime')
  if (originalSubagent?.disabled !== true || replacementSubagent?.name !== 'dsh-model-switch/subagent-runtime') throw new Error('packed Subagent runtime replacement is not composed')
}

async function verifyArtifact(packageRoot) {
  const packageReal = await realpath(packageRoot)
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  if (protocolReference.test(JSON.stringify(manifest))) throw new Error('packed manifest contains file:/link:/workspace: reference')
  const artifactFiles = await filesUnder(packageRoot)
  for (const file of artifactFiles) {
    const segments = file.path.split('/').map((segment) => segment.toLowerCase())
    if (segments.some((segment) => forbiddenSegments.has(segment)) || forbiddenExtension.test(file.path)) throw new Error('forbidden packed path: ' + file.path)
    if (textArtifact.test(file.path)) {
      const text = await readFile(file.absolute, 'utf8')
      if (/sourceMappingURL=/.test(text)) throw new Error('source map reference in ' + file.path)
      if (protocolReference.test(text)) throw new Error('forbidden local protocol in ' + file.path)
      if (privateContractReference.test(text)) throw new Error('private/fork contract reference in ' + file.path)
      if (corePathReference.test(text)) throw new Error('Core path reference in ' + file.path)
    }
  }
  await verifyPresetReplacement(packageRoot)
  await linkRuntimeDependencies(join(dirname(packageRoot), 'node_modules'), manifest)
  const targets = collectExportTargets(manifest.exports)
  for (const entry of targets) {
    if (!entry.target.startsWith('./') || entry.target.includes('..') || entry.target.includes('node_modules')) throw new Error('unsafe export target: ' + entry.target)
    const absolute = resolve(packageRoot, entry.target)
    const targetReal = await realpath(absolute).catch(() => { throw new Error('missing export target: ' + entry.target) })
    if (targetReal !== packageReal && !targetReal.startsWith(packageReal + sep)) throw new Error('export escapes package: ' + entry.target)
    const stat = await lstat(absolute)
    if (!stat.isFile()) throw new Error('export target is not a file: ' + entry.target)
    if (entry.condition === 'types') {
      if (!/\.d\.(?:ts|mts|cts)$/.test(entry.target)) throw new Error('types export is not a declaration: ' + entry.target)
    } else if (/\.(?:js|mjs|cjs)$/.test(entry.target)) {
      if (entry.subpath === './client') {
        let row
        const previousWindow = globalThis.window
        globalThis.window = { __ModuleLoader__: { load(value) { row = value } } }
        try { await import(pathToFileURL(absolute).href + '?pack-check=' + Date.now()) } finally { globalThis.window = previousWindow }
        if (row?.id !== 'dsh-model-switch' || typeof row.factory !== 'function') throw new Error('packed client entry did not register its public module row')
        const clientExports = row.factory(clientFactoryRequire())
        if (typeof clientExports?.apply !== 'function' || clientExports?.name !== 'dsh-model-switch-client') throw new Error('packed client factory did not load its public plugin exports')
      } else await import(pathToFileURL(absolute).href + '?pack-check=' + Date.now())
    } else if (entry.target.endsWith('.json')) {
      JSON.parse(await readFile(absolute, 'utf8'))
    } else throw new Error('unsupported runtime export target: ' + entry.target)
  }
  const consumer = await mkdtemp(join(tmpdir(), 'dsh-model-switch-consumer-'))
  try {
    const installed = join(consumer, 'node_modules', manifest.name)
    await mkdir(dirname(installed), { recursive: true })
    await cp(packageRoot, installed, { recursive: true })
    await linkRuntimeDependencies(join(consumer, 'node_modules'), manifest)
    await writeFile(join(consumer, 'package.json'), '{"private":true,"type":"module"}\n')
    const publicSubpaths = [...new Set(targets.map((entry) => entry.subpath))]
    for (const subpath of publicSubpaths) {
      const specifier = subpath === '.' ? manifest.name : manifest.name + subpath.slice(1)
      const code = subpath === './client'
        ? 'let row;globalThis.window={__ModuleLoader__:{load(value){row=value}}};await import(' + JSON.stringify(specifier) + ');if(row?.id!=="dsh-model-switch"||typeof row.factory!=="function")throw new Error("invalid client row");const dummy=new Proxy(function(){},{get(_t,p){if(p==="__esModule")return true;if(p==="then")return undefined;if(p==="default")return dummy;return dummy},apply(){return null},construct(){return dummy}});const entry=row.factory(()=>dummy);if(typeof entry?.apply!=="function")throw new Error("invalid client exports")'
        : specifier.endsWith('/package.json') ? 'await import(' + JSON.stringify(specifier) + ', { with: { type: "json" } })' : 'await import(' + JSON.stringify(specifier) + ')'
      await run(process.execPath, ['--input-type=module', '--eval', code], consumer)
    }
    const typeSpecifiers = [...new Set(targets.filter((entry) => entry.condition === 'types').map((entry) => entry.subpath === '.' ? manifest.name : manifest.name + entry.subpath.slice(1)))]
    await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ESNext', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, exactOptionalPropertyTypes: true, skipLibCheck: false, noEmit: true, allowImportingTsExtensions: true, lib: ['ESNext', 'DOM'], jsx: 'react-jsx' }, files: ['consumer.ts'] }, null, 2) + '\n')
    for (let index = 0; index < typeSpecifiers.length; index += 1) {
      const typeConsumer = 'import type * as Exported from ' + JSON.stringify(typeSpecifiers[index]) + '\nexport type Check = keyof typeof Exported\n'
      await writeFile(join(consumer, 'consumer.ts'), typeConsumer)
      await run(join(sourceRoot, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json'], consumer)
    }
  } finally { await rm(consumer, { recursive: true, force: true }) }
  return { files: artifactFiles.length, exports: targets.length }
}

async function packAndExtract(root, destination) {
  const packDir = join(destination, 'tarball')
  const extractDir = join(destination, 'extract')
  await mkdir(packDir, { recursive: true })
  await mkdir(extractDir, { recursive: true })
  await run('pnpm', ['pack', '--pack-destination', packDir], root)
  const tarballs = (await readdir(packDir)).filter((name) => name.endsWith('.tgz'))
  if (tarballs.length !== 1) throw new Error('expected one tarball, found ' + tarballs.length)
  await run('tar', ['-xzf', join(packDir, tarballs[0]), '-C', extractDir], root)
  return join(extractDir, 'package')
}

async function makeBuildRoot(destination) {
  await cp(sourceRoot, destination, { recursive: true, filter(source) {
    const path = relative(sourceRoot, source).split(sep).join('/')
    return path === '' || !path.split('/').some((segment) => ['.git', '.scratch', 'node_modules', 'lib'].includes(segment))
  } })
  await symlink(join(sourceRoot, 'node_modules'), join(destination, 'node_modules'), 'dir')
}

async function build(root) {
  await rm(join(root, 'lib'), { recursive: true, force: true })
  await run(join(sourceRoot, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json'], root)
  await run(join(sourceRoot, 'node_modules', '.bin', 'tsdown'), [], root)
}

async function main() {
  const temporary = await mkdtemp(join(tmpdir(), 'dsh-model-switch-pack-'))
  try {
    const currentPackage = await packAndExtract(sourceRoot, join(temporary, 'current'))
    const currentEvidence = await verifyArtifact(currentPackage)
    const roots = [join(temporary, 'root-a'), join(temporary, 'different-parent', 'root-b')]
    const inventories = []
    for (let index = 0; index < roots.length; index += 1) {
      await mkdir(dirname(roots[index]), { recursive: true })
      await makeBuildRoot(roots[index])
      await build(roots[index])
      const extracted = await packAndExtract(roots[index], join(temporary, 'repro-' + index))
      await verifyArtifact(extracted)
      inventories.push(await inventory(extracted))
    }
    if (JSON.stringify(inventories[0]) !== JSON.stringify(inventories[1])) throw new Error('packed artifacts differ across build roots')
    console.log('PACK_GATE files=' + currentEvidence.files + ' export_targets=' + currentEvidence.exports + ' declarations=consumer-tsc roots=2 reproducible=true')
  } finally { await rm(temporary, { recursive: true, force: true }) }
}

await main()
