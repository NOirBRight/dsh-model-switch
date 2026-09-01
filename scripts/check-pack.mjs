import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { cp, copyFile, lstat, mkdtemp, mkdir, readFile, readdir, realpath, rm, unlink, writeFile } from 'node:fs/promises'
import { arch, platform, tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { load, dump } from 'js-yaml'
import { applyEntryPatches, entryListSchema } from '@deepseek-ai/cordis-plugin-include'

const sourceRoot = resolve(process.cwd())
const fixtureRoot = join(sourceRoot, 'fixtures', 'alpha1')
const tarballRoot = join(fixtureRoot, 'tarballs')
const provenancePath = join(fixtureRoot, 'provenance.json')
const lockPath = join(sourceRoot, 'pnpm-lock.yaml')
const ownerName = 'dsh-llm-providers-ui'
const ownerVersion = '0.1.1'
const ownerInputSha256 = 'b2c0da03eae1cc3178e3f749a5fd2cadaa3b955b3d7e05d21d2bf818ef0b4029'
const pluginName = 'dsh-model-switch'
const packageManifest = JSON.parse(await readFile(join(sourceRoot, 'package.json'), 'utf8'))
const pluginVersion = packageManifest.version
const sourceRepository = 'https://github.com/deepseek-ai/deepseek-harness.git'
const sourceCheckout = 'tag:dsh-v0.1.2-alpha.1@cd5ef8148158c3a752a658978873241fdf8e2bbc'
const sourceTag = 'dsh-v0.1.2-alpha.1'
const sourceCommit = 'cd5ef8148158c3a752a658978873241fdf8e2bbc'
const invalidRegistry = 'http://127.0.0.1:9'
const officialVersion = '0.1.2-alpha.1'
const forbiddenSegments = new Set(['src', 'test', 'tests', '__tests__', 'scripts', 'core', 'fork-only', 'node_modules'])
const forbiddenExtension = /(?:\.map|\.patch|\.diff)$/u
const protocolReference = /(?:file|link|workspace):/u
const privateContractReference = /EXTERNAL_PLAN_HANDOFF_SENTINEL|conversation\.composer\.plan-review\.execution-model|setApprovalPreparation|PlanReviewExecutionModelAdapter|(?:plan\.(?:prepare|commit))/u
const corePathReference = /(?:^|[\/@])core(?:[\/]|$)/iu
const ownerSourceReference = /dsh-llm-providers-ui\/(?:src|test|tests)|codeload\.github\.com|github:(?:NOirBRight|noirbright)\/dsh-llm-providers-ui|\/home\/noirbright\/Workstation\/dsh-llm-providers-ui/u
const alphaResidueReference = /(?:0\.1\.1-rc|rc\.2|0\.1\.2-alpha\.2)/u
const textArtifact = /\.(?:[cm]?js|d\.[cm]?ts|json|md|ya?ml|css)$/u
const safeEnvironmentNames = [
  'PATH', 'HOME', 'USER', 'LANG', 'TMP', 'TMPDIR', 'TEMP', 'CI',
  'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)',
  'COMMONPROGRAMFILES', 'COMMONPROGRAMFILES(X86)', 'SYSTEMDRIVE', 'SYSTEMROOT',
  'WINDIR', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'COMSPEC', 'PATHEXT',
]
let isolatedUserConfig
let temporaryRoot

function sourceValue(source, name) {
  if (typeof source[name] === 'string') return source[name]
  if (platform() !== 'win32') return undefined
  const expected = name.toUpperCase()
  const key = Object.keys(source).find(candidate => candidate.toUpperCase() === expected)
  return key === undefined ? undefined : source[key]
}

function childEnvironment(options = {}) {
  const source = options.environment ?? process.env
  const environment = {}
  for (const name of safeEnvironmentNames) {
    const value = sourceValue(source, name)
    if (typeof value === 'string') environment[name] = value
  }
  environment.CI = '1'
  environment.LANG = 'C'
  environment.LC_ALL = 'C'
  environment.TZ = 'UTC'
  environment.SOURCE_DATE_EPOCH = '0'
  environment.FORCE_COLOR = '0'
  environment.NO_COLOR = '1'
  environment.NODE_PATH = ''
  environment.NODE_OPTIONS = ''
  return environment
}

function run(command, args, cwd, options = {}) {
  const userConfig = options.userConfig ?? isolatedUserConfig
  const childArgs = command === 'pnpm' && userConfig !== undefined
    ? ['--config.userconfig=' + userConfig, '--config.globalconfig=' + userConfig, ...args]
    : args
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, childArgs, { cwd, env: childEnvironment(options), stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code === 0) return resolveRun(stdout)
      reject(new Error(command + ' ' + childArgs.join(' ') + ' in ' + cwd + ' failed (' + String(code ?? signal) + ')\n' + stdout + '\n' + stderr))
    })
  })
}

function cleanupFailure(errors) {
  if (errors.length === 1) return errors[0]
  return new AggregateError(errors, 'temporary-tree cleanup failed')
}

async function safeRemove(path) {
  const info = await lstat(path).catch(error => {
    if (error?.code === 'ENOENT') return undefined
    throw error
  })
  if (info === undefined) return
  if (info.isSymbolicLink()) return unlink(path)
  if (!info.isDirectory()) return rm(path, { force: true })
  const resolved = await realpath(path).catch(error => {
    if (error?.code === 'ENOENT') return undefined
    throw error
  })
  if (resolved === undefined) return
  if (temporaryRoot !== undefined) {
    const root = await realpath(temporaryRoot)
    const relativePath = relative(root, resolved)
    if (relativePath === '..' || relativePath.startsWith('..' + sep) || isAbsolute(relativePath)) throw new Error('temporary cleanup escaped its root: ' + path)
  }
  const errors = []
  let entries = []
  try {
    entries = await readdir(path, { withFileTypes: true })
  } catch (error) {
    errors.push(error)
  }
  for (const entry of entries) {
    try {
      await safeRemove(join(path, entry.name))
    } catch (error) {
      errors.push(error)
    }
  }
  try {
    await rm(path, { recursive: true, force: true })
  } catch (error) {
    errors.push(error)
  }
  if (errors.length > 0) throw cleanupFailure(errors)
}

async function filesUnder(root) {
  const output = []
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name)
      const path = relative(root, absolute).split(sep).join('/')
      if (entry.isSymbolicLink()) throw new Error('symbolic link is not allowed: ' + path)
      if (entry.isDirectory()) await visit(absolute)
      else if (entry.isFile()) output.push({ path, absolute })
      else throw new Error('non-regular file is not allowed: ' + path)
    }
  }
  await visit(root)
  return output.sort((a, b) => a.path.localeCompare(b.path))
}

async function assertNoSymlinks(root) {
  const info = await lstat(root)
  if (info.isSymbolicLink()) throw new Error('symbolic link is not allowed: ' + root)
  if (!info.isDirectory()) return
  await filesUnder(root)
}

async function assertNoDependencySymlinks(root) {
  const info = await lstat(root)
  if (info.isSymbolicLink()) throw new Error('dependency tree symlink is not allowed: ' + root)
  if (!info.isDirectory()) return
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === '.bin') continue
    const child = join(root, entry.name)
    if (entry.isSymbolicLink()) throw new Error('dependency tree symlink is not allowed: ' + child)
    if (entry.isDirectory()) await assertNoDependencySymlinks(child)
  }
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

function collectExportTargets(exportsValue) {
  const targets = []
  function walk(value, subpath, condition) {
    if (typeof value === 'string') { targets.push({ subpath, condition, target: value }); return }
    if (value === null) return
    if (Array.isArray(value)) throw new Error('export arrays are not supported')
    if (typeof value !== 'object') throw new Error('invalid exports entry for ' + subpath)
    const keys = Object.keys(value)
    const subpaths = keys.filter(key => key === '.' || key.startsWith('./'))
    if (subpaths.length > 0 && subpaths.length !== keys.length) throw new Error('mixed subpath and condition exports')
    for (const key of keys) {
      if (key.includes('*')) throw new Error('wildcard exports are not supported')
      walk(value[key], subpaths.length > 0 ? key : subpath, subpaths.length > 0 ? 'default' : key)
    }
  }
  walk(exportsValue, '.', 'default')
  return targets
}

function packageRoot(name) {
  return name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0]
}

function parseLocator(locator) {
  const peerStart = locator.indexOf('(')
  const base = peerStart < 0 ? locator : locator.slice(0, peerStart)
  const at = base.startsWith('@') ? base.indexOf('@', 1) : base.indexOf('@')
  if (at <= 0) throw new Error('invalid lock locator: ' + locator)
  return { name: base.slice(0, at), rawVersion: base.slice(at + 1), base }
}

function canonicalFileRef(value) {
  return typeof value === 'string' && value.startsWith('file:') ? value : undefined
}

function isExactVersion(value) {
  return typeof value === 'string' && value !== '' && !/^(?:[~^<>=*|]|latest$|workspace:|link:)/u.test(value)
}

function findSnapshotLocator(name, value, snapshots) {
  const keys = Object.keys(snapshots)
  const exact = keys.filter(key => key === name + '@' + value)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) throw new Error('duplicate locked edge: ' + name + '@' + value)
  const prefixed = keys.filter(key => key.startsWith(name + '@' + value + '('))
  if (prefixed.length === 1) return prefixed[0]
  if (prefixed.length > 1) throw new Error('ambiguous locked edge: ' + name + '@' + value)
  const matchingBase = keys.filter(key => {
    const parsed = parseLocator(key)
    return parsed.name === name && parsed.rawVersion === value
  })
  if (matchingBase.length === 1) return matchingBase[0]
  if (matchingBase.length > 1) throw new Error('ambiguous locked edge without peer context: ' + name + '@' + value)
  throw new Error('missing locked target for edge: ' + name + '@' + value)
}

async function safeTarListing(archive) {
  const listing = (await run('tar', ['-tzf', archive], sourceRoot)).split(/\r?\n/u).filter(Boolean)
  for (const name of listing) {
    const clean = name.endsWith('/') ? name.slice(0, -1) : name
    if (clean.startsWith('/') || clean.split('/').includes('..') || !clean.startsWith('package/')) throw new Error('unsafe archive path in ' + basename(archive) + ': ' + name)
  }
  return listing
}

async function inspectArchive(archive, destination) {
  const listing = await safeTarListing(archive)
  if (!listing.includes('package/package.json')) throw new Error('archive has no package/package.json: ' + basename(archive))
  await safeRemove(destination)
  await mkdir(destination, { recursive: true })
  await run('tar', ['-xzf', archive, '-C', destination, '--no-same-owner', '--no-same-permissions'], sourceRoot)
  const packageRoot = join(destination, 'package')
  await assertNoSymlinks(destination)
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') throw new Error('archive manifest lacks name/version: ' + basename(archive))
  const archiveStem = basename(archive, '.tgz')
  const packageStem = (manifest.name.startsWith('@') ? manifest.name.slice(1).replace('/', '-') : manifest.name) + '-' + manifest.version
  if (archiveStem !== packageStem && !archiveStem.startsWith(packageStem + '-')) throw new Error('archive filename does not identify ' + manifest.name + '@' + manifest.version)
  const bytes = await readFile(archive)
  const sha512Bytes = createHash('sha512').update(bytes).digest()
  return {
    archive,
    file: relative(sourceRoot, archive).split(sep).join('/'),
    root: packageRoot,
    manifest,
    listing,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sha512: sha512Bytes.toString('hex'),
    sha512Base64: sha512Bytes.toString('base64'),
  }
}

async function inspectFixtureArchives(temporary) {
  const entries = await readdir(tarballRoot, { withFileTypes: true })
  if (entries.some(entry => !entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith('.tgz'))) throw new Error('fixture tarball directory contains an unexpected entry')
  const archives = entries.sort((a, b) => a.name.localeCompare(b.name))
  if (archives.length === 0) throw new Error('no closure tarballs found')
  const result = []
  const identities = new Set()
  for (let index = 0; index < archives.length; index += 1) {
    const entry = archives[index]
    const archive = await inspectArchive(join(tarballRoot, entry.name), join(temporary, 'fixture-' + index))
    const identity = archive.manifest.name + '@' + archive.manifest.version
    if (identities.has(identity)) throw new Error('duplicate fixture package identity: ' + identity)
    identities.add(identity)
    result.push(archive)
  }
  return result
}

async function verifyProvenance(archives) {
  const report = JSON.parse(await readFile(provenancePath, 'utf8'))
  if (report.format !== 2 || !Array.isArray(report.artifacts)) throw new Error('provenance report must use format 2')
  if (report.sourceRepository !== sourceRepository || report.sourceCheckout !== sourceCheckout || report.tag !== sourceTag || report.commit !== sourceCommit) throw new Error('provenance source identity is not the official alpha.1 checkout')
  if (report.toolchain?.packageManager !== packageManifest.packageManager) throw new Error('provenance package manager does not match package.json')
  const byFile = new Map()
  for (const record of report.artifacts) {
    if (typeof record.file !== 'string' || byFile.has(record.file)) throw new Error('duplicate or invalid provenance file')
    byFile.set(record.file, record)
  }
  if (byFile.size !== archives.length) throw new Error('provenance/archive count mismatch')
  const allowedSources = new Set(['official-clean-alpha1', 'authenticated-owner', 'repo'])
  for (const archive of archives) {
    const record = byFile.get(archive.file)
    if (record === undefined) throw new Error('archive missing from provenance: ' + archive.file)
    for (const [key, expected] of [['name', archive.manifest.name], ['version', archive.manifest.version], ['bytes', archive.bytes], ['sha256', archive.sha256], ['sha512', archive.sha512]]) {
      if (record[key] !== expected) throw new Error('provenance mismatch for ' + archive.file + ': ' + key)
    }
    if (!allowedSources.has(record.sourceKind) || typeof record.sourcePath !== 'string' || record.sourcePath === '') throw new Error('provenance source missing for ' + archive.file)
    if (archive.manifest.name.startsWith('@deepseek-ai/dsh-') && (record.sourceKind !== 'official-clean-alpha1' || archive.manifest.version !== officialVersion || !record.sourcePath.startsWith('packages/'))) throw new Error('official alpha provenance mismatch for ' + archive.manifest.name)
    if (archive.manifest.name === ownerName && (record.sourceKind !== 'authenticated-owner' || archive.manifest.version !== ownerVersion || record.sourcePath !== 'owner-tarball-input' || record.provisional !== false)) throw new Error('frozen owner provenance mismatch')
    if (archive.manifest.name === pluginName && (record.sourceKind !== 'repo' || record.sourcePath !== '.')) throw new Error('plugin provenance mismatch')
  }
  const owner = archives.find(archive => archive.manifest.name === ownerName && archive.manifest.version === ownerVersion)
  if (owner === undefined) throw new Error('owner archive is missing')
  const ownerInput = report.owner?.input
  if (report.owner?.name !== ownerName || report.owner?.version !== ownerVersion || ownerInput?.file !== owner.file || ownerInput?.bytes !== owner.bytes || ownerInput?.sha256 !== owner.sha256 || ownerInput?.sha256 !== ownerInputSha256 || owner.sha256 !== ownerInputSha256 || ownerInput?.source !== 'authenticated owner tarball fixture' || ownerInput?.provisional !== false) throw new Error('owner input report does not match immutable frozen archive')
  return { report, owner }
}

function readFixtureByRef(archives, ref) {
  const file = ref.startsWith('file:') ? ref.slice(5) : ref
  const archive = archives.find(item => item.file === file)
  if (archive === undefined) throw new Error('missing fixture archive: ' + file)
  return archive
}

async function verifyLock(archives, provenance) {
  const lockText = await readFile(lockPath, 'utf8')
  if (/github:|codeload\.github\.com|NOirBRight\/dsh-llm-providers-ui|dsh-llm-providers-ui\/src\/order\.js/iu.test(lockText)) throw new Error('lock contains old GitHub or private owner resolution')
  const lock = load(lockText)
  if (lock.lockfileVersion !== '9.0' || lock.settings?.autoInstallPeers !== false) throw new Error('lockfile must use version 9 with autoInstallPeers=false')
  const manifest = JSON.parse(await readFile(join(sourceRoot, 'package.json'), 'utf8'))
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (name.startsWith('@deepseek-ai/dsh-') && version !== officialVersion) throw new Error('manifest DSH dependency must be exact ' + officialVersion + ': ' + name)
      if (typeof version === 'string' && /(?:0\.1\.1-rc|rc\.2|0\.1\.2-alpha\.2|workspace:)/u.test(version)) throw new Error('manifest contains stale or local dependency range: ' + name)
    }
  }
  if (manifest.devDependencies?.[ownerName] !== ownerVersion) throw new Error('owner build dependency must be exact ' + ownerVersion)
  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    if (manifest[section]?.[ownerName] !== undefined) throw new Error('owner must not be a runtime dependency: ' + section)
  }
  const workspace = load(await readFile(join(sourceRoot, 'pnpm-workspace.yaml'), 'utf8'))
  for (const archive of archives) {
    if (archive.manifest.name === pluginName) continue
    const expected = 'file:fixtures/alpha1/tarballs/' + basename(archive.archive)
    if (workspace.overrides?.[archive.manifest.name] !== expected) throw new Error('fixture archive has no exact workspace override: ' + archive.manifest.name)
  }
  const owner = provenance.owner
  const ownerRef = 'file:' + owner.input.file
  if (workspace.overrides?.[ownerName] !== ownerRef) throw new Error('owner must resolve only through its fixture override')
  for (const [key, value] of Object.entries(workspace.overrides ?? {})) {
    if (typeof value !== 'string') throw new Error('unsafe workspace override: ' + key)
    if ((protocolReference.test(value) && !value.startsWith('file:fixtures/alpha1/tarballs/')) || /github|codeload|Workstation\/dsh-llm-providers-ui|src\/order/iu.test(value)) throw new Error('unsafe workspace override: ' + key)
  }
  const packages = lock.packages ?? {}
  const snapshots = lock.snapshots ?? {}
  const packageKeys = Object.keys(packages)
  const localRefs = new Set()
  const packageInfo = new Map()
  for (const [locator, metadata] of Object.entries(packages)) {
    const parsed = parseLocator(locator)
    const localRef = canonicalFileRef(metadata?.resolution?.tarball)
    if (localRef !== undefined) {
      const archive = readFixtureByRef(archives, localRef)
      if (archive.manifest.name !== parsed.name) throw new Error('local package name mismatch: ' + locator)
      if (metadata.resolution.integrity !== 'sha512-' + archive.sha512Base64) throw new Error('local package integrity mismatch: ' + locator)
      localRefs.add(archive.file)
      packageInfo.set(locator, { name: archive.manifest.name, version: archive.manifest.version, archive })
    } else {
      if (typeof metadata?.resolution?.integrity !== 'string' || metadata.resolution.integrity === '') throw new Error('registry package has no integrity: ' + locator)
      if (parsed.name.startsWith('@deepseek-ai/dsh-') || parsed.name === ownerName) throw new Error('alpha/owner package escaped fixture override: ' + locator)
      packageInfo.set(locator, { name: parsed.name, version: parsed.rawVersion, source: 'registry', integrity: metadata.resolution.integrity, os: metadata.os, cpu: metadata.cpu })
    }
  }
  const expectedFixtureRefs = new Set(archives.filter(archive => archive.manifest.name !== pluginName).map(archive => archive.file))
  if (localRefs.size !== expectedFixtureRefs.size || [...expectedFixtureRefs].some(file => !localRefs.has(file))) throw new Error('fixture tarballs and lock local resolutions differ')
  const ownerLocal = archives.find(archive => archive.manifest.name === ownerName && archive.manifest.version === ownerVersion)
  if (ownerLocal === undefined || !localRefs.has(ownerLocal.file)) throw new Error('owner is not in locked local closure')
  const versions = new Map()
  for (const [locator, info] of packageInfo) {
    const list = versions.get(info.name) ?? new Set()
    list.add(info.version)
    versions.set(info.name, list)
    if (info.name.startsWith('@deepseek-ai/dsh-') && info.version !== officialVersion) throw new Error('non-alpha DSH version in lock: ' + locator)
    if (info.name === ownerName && info.version !== ownerVersion) throw new Error('duplicate owner version in lock: ' + locator)
  }
  const duplicateNames = [...versions].filter(([, values]) => values.size > 1).map(([name, values]) => ({ name, versions: [...values].sort() }))
  for (const [snapshotLocator] of Object.entries(snapshots)) {
    const parsed = parseLocator(snapshotLocator)
    const found = packageKeys.some(packageLocator => {
      const candidate = parseLocator(packageLocator)
      return candidate.name === parsed.name && candidate.rawVersion === parsed.rawVersion
    })
    if (!found) throw new Error('snapshot has no package metadata: ' + snapshotLocator)
  }
  let edges = 0
  function verifyEdge(parent, name, value) {
    if (!isExactVersion(value)) throw new Error('unlocked dependency edge ' + parent + ' -> ' + name + ': ' + value)
    findSnapshotLocator(name, value, snapshots)
    edges += 1
  }
  const importer = lock.importers?.['.']
  if (importer === undefined) throw new Error('root importer is missing')
  for (const section of ['dependencies', 'optionalDependencies', 'devDependencies']) for (const [name, item] of Object.entries(importer[section] ?? {})) verifyEdge('importer', name, item.version)
  for (const [locator, snapshot] of Object.entries(snapshots)) {
    for (const section of ['dependencies', 'optionalDependencies']) for (const [name, value] of Object.entries(snapshot[section] ?? {})) verifyEdge(locator, name, value)
  }
  return { lock, packages: packageInfo, localPackages: localRefs.size, registryPackages: packageInfo.size - localRefs.size, snapshots: Object.keys(snapshots).length, edges, duplicateNames }
}

async function collectStoreIndexes(storeDir) {
  const indexes = new Map()
  const root = join(storeDir, 'index')
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw new Error('pnpm store index contains a symlink')
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
        continue
      }
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      const metadata = JSON.parse(await readFile(path, 'utf8'))
      if (typeof metadata.name !== 'string' || typeof metadata.version !== 'string' || metadata.files === undefined) continue
      const key = metadata.name + '@' + metadata.version
      const candidates = indexes.get(key) ?? []
      candidates.push({ path, metadata })
      indexes.set(key, candidates)
    }
  }
  await visit(root)
  return indexes
}

async function copyCasFile(sourceStore, targetStore, file) {
  const integrity = file?.integrity
  if (typeof integrity !== 'string' || !integrity.startsWith('sha512-')) throw new Error('pnpm store file has no sha512 integrity')
  const digest = Buffer.from(integrity.slice(7), 'base64').toString('hex')
  const suffix = (file.mode & 0o111) === 0 ? '' : '-exec'
  const source = join(sourceStore, 'files', digest.slice(0, 2), digest.slice(2) + suffix)
  const target = join(targetStore, 'files', digest.slice(0, 2), digest.slice(2) + suffix)
  await mkdir(dirname(target), { recursive: true })
  await copyFile(source, target)
}

function supportsCurrentPlatform(values, current) {
  if (values === undefined) return true
  const list = Array.isArray(values) ? values : [values]
  if (list.some(value => typeof value !== 'string')) throw new Error('invalid package platform constraint')
  if (list.includes('!' + current)) return false
  const positive = list.filter(value => !value.startsWith('!'))
  return positive.length === 0 || positive.includes(current)
}

function isCurrentPlatform(info) {
  return supportsCurrentPlatform(info.os, platform()) && supportsCurrentPlatform(info.cpu, arch())
}

async function stageRegistryStore(sourceStore, targetStore, packageInfo) {
  await mkdir(targetStore, { recursive: true })
  const indexes = await collectStoreIndexes(sourceStore)
  const registryPackages = [...packageInfo.values()].filter(info => info.source === 'registry' && isCurrentPlatform(info))
  const identities = new Map()
  for (const info of registryPackages) identities.set(info.name + '@' + info.version, info)
  for (const [identity, info] of identities) {
    const candidates = indexes.get(identity) ?? []
    const digest = typeof info.integrity === 'string' && info.integrity.startsWith('sha512-')
      ? Buffer.from(info.integrity.slice(7), 'base64').toString('hex')
      : undefined
    const suffix = '-' + info.name.replace('/', '+') + '@' + info.version + '.json'
    const candidate = candidates.find(item => digest !== undefined && basename(item.path).startsWith(digest.slice(2, 64) + '-') && basename(item.path).endsWith(suffix))
    if (candidate === undefined) throw new Error('registry package is absent from the available pnpm store: ' + identity)
    const relativeIndex = relative(sourceStore, candidate.path)
    const targetIndex = join(targetStore, relativeIndex)
    await mkdir(dirname(targetIndex), { recursive: true })
    await copyFile(candidate.path, targetIndex)
    for (const file of Object.values(candidate.metadata.files)) await copyCasFile(sourceStore, targetStore, file)
  }
  return identities.size
}

async function stageRegistryLock(sourceStore, targetStore, lockFile) {
  const lock = load(await readFile(lockFile, 'utf8'))
  const packageInfo = new Map()
  for (const [locator, metadata] of Object.entries(lock.packages ?? {})) {
    if (canonicalFileRef(metadata?.resolution?.tarball) !== undefined) continue
    if (typeof metadata?.resolution?.integrity !== 'string') throw new Error('consumer lock registry package has no integrity: ' + locator)
    const parsed = parseLocator(locator)
    packageInfo.set(locator, { name: parsed.name, version: parsed.rawVersion, source: 'registry', integrity: metadata.resolution.integrity, os: metadata.os, cpu: metadata.cpu })
  }
  return stageRegistryStore(sourceStore, targetStore, packageInfo)
}

async function verifyPresetReplacement(packageRoot) {
  const patches = load(await readFile(join(packageRoot, 'cordis.patch.yml'), 'utf8'), { schema: entryListSchema })
  const warnings = []
  const composed = applyEntryPatches([{ id: 'subagent', name: '@deepseek-ai/dsh-subagent' }], patches, message => warnings.push(message))
  if (warnings.length) throw new Error('preset patch warnings: ' + warnings.join('; '))
  const originalSubagent = composed.find(row => row.id === 'subagent')
  const replacementSubagent = composed.find(row => row.id === 'model-switch-subagent-runtime')
  if (originalSubagent?.disabled !== true || replacementSubagent?.name !== 'dsh-model-switch/subagent-runtime') throw new Error('packed Subagent runtime replacement is not composed')
}

async function verifyArtifact(artifactRoot) {
  const manifest = JSON.parse(await readFile(join(artifactRoot, 'package.json'), 'utf8'))
  if (manifest.name !== pluginName || manifest.version !== pluginVersion) throw new Error('unexpected packed plugin identity')
  if (protocolReference.test(JSON.stringify(manifest))) throw new Error('packed manifest contains local protocol reference')
  const artifactFiles = await filesUnder(artifactRoot)
  const declared = new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {}), ...Object.keys(manifest.optionalDependencies ?? {})])
  for (const file of artifactFiles) {
    const segments = file.path.split('/').map(segment => segment.toLowerCase())
    if (segments.some(segment => forbiddenSegments.has(segment)) || forbiddenExtension.test(file.path)) throw new Error('forbidden packed path: ' + file.path)
    if (textArtifact.test(file.path)) {
      const text = await readFile(file.absolute, 'utf8')
      if (/sourceMappingURL=/u.test(text)) throw new Error('source map reference in ' + file.path)
      const codeArtifact = /\.(?:[cm]?js|d\.[cm]?ts|json|ya?ml)$/u.test(file.path)
      if (protocolReference.test(text) || privateContractReference.test(text) || corePathReference.test(text) || ownerSourceReference.test(text) || codeArtifact && alphaResidueReference.test(text)) throw new Error('forbidden static reference in ' + file.path)
      const imports = [...text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/gu)].map(match => match[1])
      for (const specifier of imports) if (!specifier.startsWith('.') && !specifier.startsWith('node:') && !declared.has(packageRoot(specifier))) throw new Error('undeclared static package import ' + specifier + ' in ' + file.path)
    }
  }
  await verifyPresetReplacement(artifactRoot)
  const targets = collectExportTargets(manifest.exports)
  for (const entry of targets) {
    if (!entry.target.startsWith('./') || entry.target.includes('..')) throw new Error('invalid export target: ' + entry.target)
    const target = join(artifactRoot, entry.target.slice(2))
    const stat = await lstat(target).catch(() => undefined)
    if (stat === undefined || !stat.isFile()) throw new Error('missing export target: ' + entry.target)
  }
  return { files: artifactFiles.length, exports: targets.length }
}

async function packAndExtract(root, destination) {
  const packDir = join(destination, 'tarball')
  const extractDir = join(destination, 'extract')
  await safeRemove(destination)
  await mkdir(packDir, { recursive: true })
  await mkdir(extractDir, { recursive: true })
  await run('pnpm', ['pack', '--pack-destination', packDir], root)
  const tarballs = (await readdir(packDir)).filter(name => name.endsWith('.tgz'))
  if (tarballs.length !== 1) throw new Error('expected one plugin tarball, found ' + tarballs.length)
  const tarball = join(packDir, tarballs[0])
  await safeTarListing(tarball)
  await run('tar', ['-xzf', tarball, '-C', extractDir, '--no-same-owner', '--no-same-permissions'], root)
  await assertNoSymlinks(extractDir)
  const bytes = await readFile(tarball)
  return { tarball, packageRoot: join(extractDir, 'package'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), sha512: createHash('sha512').update(bytes).digest('hex') }
}

async function makeBuildRoot(destination) {
  await safeRemove(destination)
  await cp(sourceRoot, destination, { recursive: true, dereference: true, filter(source) {
    const path = relative(sourceRoot, source).split(sep).join('/')
    return path === '' || !path.split('/').some(segment => ['.git', '.scratch', 'node_modules', 'lib'].includes(segment))
  } })
  await assertNoSymlinks(destination)
}

async function installFresh(root, storeDir, registry = invalidRegistry) {
  await writeFile(join(root, '.npmrc'), 'auto-install-peers=false\nnode-linker=hoisted\nbin-links=false\n')
  await run('pnpm', ['install', '--offline', '--frozen-lockfile', '--ignore-scripts', '--config.confirmModulesPurge=false', '--config.auto-install-peers=false', '--config.node-linker=hoisted', '--config.bin-links=false', '--store-dir=' + storeDir, '--registry=' + registry], root)
  await assertNoDependencySymlinks(join(root, 'node_modules'))
}

async function verifyEnvironmentIsolation(temporary) {
  const probePath = join(temporary, 'environment-negative.mjs')
  const allowed = JSON.stringify([...safeEnvironmentNames, 'NODE_PATH', 'NODE_OPTIONS', 'LC_ALL', 'TZ', 'SOURCE_DATE_EPOCH', 'FORCE_COLOR', 'NO_COLOR'])
  const probe = [
    'const allowed = new Set(' + allowed + ')',
    'const blocked = [',
    '  \'DEEPSEEK_API_KEY\', \'AWS_ACCESS_KEY_ID\', \'AWS_SECRET_ACCESS_KEY\', \'GITHUB_TOKEN\',',
    '  \'GATE_EMPTY_SECRET\', \'GATE_EMPTY_TOKEN\', \'GATE_EMPTY_PASSWORD\',',
    '  \'GATE_EMPTY_CREDENTIAL\', \'GATE_EMPTY_AUTH\', \'AUTH_TOKEN\', \'GATE_EMPTY_CLOUD\',',
    '  \'NPM_CONFIG_REGISTRY\', \'NPM_CONFIG_CACHE\', \'npm_config_cache\', \'npm_config_store_dir\', \'npm_config_prefix\', \'npm_config_userconfig\',',
    '  \'NPM_CONFIG_USERCONFIG\', \'NPM_CONFIG_GLOBALCONFIG\', \'PNPM_HOME\', \'COREPACK_HOME\', \'COREPACK_INTEGRITY_KEYS\',',
    '  \'YARN_CACHE_FOLDER\', \'PACKAGE_MANAGER_CONFIG\', \'CLOUDSDK_CONFIG\', \'GOOGLE_APPLICATION_CREDENTIALS\', \'AZURE_CLIENT_SECRET\',',
    ']',
    "for (const key of Object.keys(process.env)) if (!allowed.has(key)) throw new Error('unexpected child environment name: ' + key)",
    "for (const key of blocked) if (Object.prototype.hasOwnProperty.call(process.env, key)) throw new Error('blocked child environment name survived: ' + key)",
    "if (process.env.NODE_PATH !== '' || process.env.NODE_OPTIONS !== '') throw new Error('Node environment poison was not emptied')",
  ].join('\n') + '\n'
  await writeFile(probePath, probe)
  const hostileEnvironment = {
    PATH: sourceValue(process.env, 'PATH'),
    HOME: sourceValue(process.env, 'HOME'),
    USER: sourceValue(process.env, 'USER'),
    LANG: sourceValue(process.env, 'LANG'),
    TMP: sourceValue(process.env, 'TMP'),
    TMPDIR: sourceValue(process.env, 'TMPDIR'),
    TEMP: sourceValue(process.env, 'TEMP'),
    GATE_EMPTY_KEY: '',
    AWS_ACCESS_KEY_ID: '',
    GATE_EMPTY_SECRET: '',
    GATE_EMPTY_TOKEN: '',
    GATE_EMPTY_PASSWORD: '',
    GATE_EMPTY_CREDENTIAL: '',
    GATE_EMPTY_AUTH: '',
    AUTH_TOKEN: '',
    GATE_EMPTY_CLOUD: '',
    DEEPSEEK_API_KEY: '',
    AWS_SECRET_ACCESS_KEY: '',
    GITHUB_TOKEN: '',
    NPM_CONFIG_REGISTRY: 'https://registry.example.invalid',
    NPM_CONFIG_CACHE: '',
    npm_config_cache: '/tmp/poison-cache',
    npm_config_store_dir: '',
    npm_config_prefix: '',
    npm_config_userconfig: '/tmp/poison-userconfig',
    PNPM_HOME: '/tmp/poison-pnpm',
    COREPACK_HOME: '/tmp/poison-corepack',
    YARN_CACHE_FOLDER: '/tmp/poison-yarn',
    PACKAGE_MANAGER_CONFIG: '/tmp/poison-config',
    CLOUDSDK_CONFIG: '',
    GOOGLE_APPLICATION_CREDENTIALS: '',
    AZURE_CLIENT_SECRET: '',
    COREPACK_INTEGRITY_KEYS: '',
    NODE_PATH: '/tmp/poison-node-path',
    NODE_OPTIONS: '--trace-warnings',
  }
  await run(process.execPath, [probePath], sourceRoot, { environment: hostileEnvironment })
}

async function build(root) {
  await safeRemove(join(root, 'lib'))
  await run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], root)
  await run('pnpm', ['exec', 'tsdown'], root)
}

function consumerManifest(archives) {
  const dependencies = {
    [pluginName]: 'file:./dsh-model-switch.tgz',
    '@deepseek-ai/cordis': '4.0.1',
    '@deepseek-ai/schemastery': '3.18.1',
    react: '18.3.1',
    'react-dom': '18.3.1',
    typescript: '5.9.3',
  }
  for (const archive of archives) if (archive.manifest.name !== pluginName) dependencies[archive.manifest.name] = archive.manifest.version
  return { name: 'dsh-model-switch-pack-consumer', version: '1.0.0', private: true, type: 'module', dependencies }
}

async function consumerWorkspace(archives, sourceWorkspace) {
  const overrides = {}
  for (const archive of archives) if (archive.manifest.name !== pluginName && (archive.manifest.name.startsWith('@deepseek-ai/') || archive.manifest.name === ownerName)) overrides[archive.manifest.name] = 'file:fixtures/alpha1/tarballs/' + basename(archive.archive)
  for (const [key, value] of Object.entries(sourceWorkspace.overrides ?? {})) if (key.includes('>')) overrides[key] = value
  return { packages: ['.'], settings: { autoInstallPeers: false }, overrides }
}

async function typecheckInstalledConsumer(consumer) {
  await writeFile(join(consumer, 'consumer.ts'), [
    "import type * as Host from 'dsh-model-switch'",
    "import type * as Runtime from 'dsh-model-switch/subagent-runtime'",
    "import type * as Capabilities from 'dsh-model-switch/capabilities'",
    "import type * as OwnerOrder from 'dsh-llm-providers-ui/order'",
    'export type Check = keyof typeof Host & keyof typeof Runtime & keyof typeof Capabilities & keyof typeof OwnerOrder',
  ].join('\n') + '\n')
  await writeFile(join(consumer, 'tsconfig.smoke.json'), JSON.stringify({ compilerOptions: { strict: true, module: 'NodeNext', moduleResolution: 'NodeNext', target: 'ES2022', skipLibCheck: true }, files: ['consumer.ts'] }, null, 2) + '\n')
  await run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.smoke.json', '--noEmit'], consumer)
}

async function runInstalledSmokes(consumer) {
  const hostSmoke = [
    "import { Context, Service } from '@deepseek-ai/cordis'",
    "import ModelSwitchRuntime from 'dsh-model-switch'",
    "import OfficialSubagentRuntime from '@deepseek-ai/dsh-subagent'",
    "import profileSubagentRuntime from 'dsh-model-switch/subagent-runtime'",
    "import { sortCatalogGroups } from 'dsh-llm-providers-ui/order'",
    '',
    'class AgentDefaultModel extends Service {',
    '  static inject = []',
    "  constructor(ctx) { super(ctx, 'agentDefaultModel') }",
    "  currentSelection() { return { provider: 'deepseek', model: 'deepseek-chat' } }",
    '  async saveSelection() {}',
    '}',
    'class Tools extends Service {',
    '  static inject = []',
    "  constructor(ctx) { super(ctx, 'tools') }",
    '  register() { return () => {} }',
    '}',
    'class Web extends Service {',
    '  static inject = []',
    "  constructor(ctx) { super(ctx, 'web') }",
    '  registerSearchProvider() { return () => {} }',
    '}',
    '',
    'const host = new Context()',
    'await host.plugin(AgentDefaultModel)',
    'await host.plugin(Tools)',
    'await host.plugin(Web)',
    "await host.plugin(ModelSwitchRuntime, { subagentMode: 'follow-main' })",
    'if (!(host.modelSwitch instanceof ModelSwitchRuntime)) throw new Error(\'installed Host runtime did not mount\')',
    'await host.fiber.dispose()',
    '',
    'class IncompatibleModelSwitch extends Service {',
    '  static inject = []',
    "  constructor(ctx) { super(ctx, 'modelSwitch') }",
    "  currentSettings() { return { subagentMode: 'follow-main' } }",
    '}',
    'const fallback = new Context()',
    'await fallback.plugin(IncompatibleModelSwitch)',
    'await fallback.plugin(profileSubagentRuntime)',
    'if (!(fallback.subagents instanceof OfficialSubagentRuntime)) throw new Error(\'installed Subagent fallback did not mount official runtime\')',
    'await fallback.fiber.dispose()',
    '',
    'const ordered = sortCatalogGroups([',
    "  { id: 'deepseek-official', name: 'DeepSeek', models: [] },",
    "  { id: 'cursor', name: 'Cursor', models: [] },",
    "  { id: 'grok', name: 'Grok', models: [] },",
    "], ['llm-grok', 'llm-cursor'])",
    "if (ordered.map(group => group.id).join(',') !== 'grok,cursor,deepseek-official') throw new Error('owner order export returned an unexpected order')",
  ].join('\n') + '\n'
  const clientSmoke = [
    'const rows = []',
    'globalThis.window = { __ModuleLoader__: { load(row) { rows.push(row) } } }',
    "await import('dsh-model-switch/client')",
    "const row = rows.find(item => item.id === 'dsh-model-switch')",
    "if (row === undefined) throw new Error('client ModuleLoader row was not registered')",
    "const [react, jsx, reactDom] = await Promise.all([import('react'), import('react/jsx-runtime'), import('react-dom')])",
    "const values = { react, 'react/jsx-runtime': jsx, 'react-dom': reactDom, '@deepseek-ai/dsh-client-ui-primitives': {} }",
    'const exported = row.factory(id => {',
    '  const value = values[id]',
    "  if (value === undefined) throw new Error('unresolved client dependency: ' + id)",
    '  return value',
    '})',
    "if (typeof exported.apply !== 'function' || !Array.isArray(exported.inject)) throw new Error('client ModuleLoader factory did not expose plugin hooks')",
  ].join('\n') + '\n'
  await writeFile(join(consumer, 'installed-host-smoke.mjs'), hostSmoke)
  await writeFile(join(consumer, 'installed-client-smoke.mjs'), clientSmoke)
  await run('node', ['installed-host-smoke.mjs'], consumer)
  await run('node', ['installed-client-smoke.mjs'], consumer)
}

async function main() {
  const temporary = await mkdtemp(join(tmpdir(), 'dsh-model-switch-pack-'))
  temporaryRoot = temporary
  isolatedUserConfig = join(temporary, 'empty-userconfig.npmrc')
  let primaryError
  try {
    await writeFile(isolatedUserConfig, '')
    await verifyEnvironmentIsolation(temporary)
    const archives = await inspectFixtureArchives(temporary)
    const provenance = await verifyProvenance(archives)
    const lock = await verifyLock(archives, provenance.report)
    const current = await packAndExtract(sourceRoot, join(temporary, 'current'))
    const currentEvidence = await verifyArtifact(current.packageRoot)
    const pluginFixture = archives.find(archive => archive.manifest.name === pluginName && archive.manifest.version === pluginVersion)
    if (pluginFixture === undefined || pluginFixture.bytes !== current.bytes || pluginFixture.sha256 !== current.sha256 || pluginFixture.sha512 !== current.sha512) throw new Error('plugin tarball fixture/report does not match current pack')
    const roots = [join(temporary, 'root-a'), join(temporary, 'different-parent', 'root-b')]
    const storeDir = (await run('pnpm', ['store', 'path'], sourceRoot)).trim()
    const isolatedStore = join(temporary, 'empty-store')
    await mkdir(isolatedStore, { recursive: true })
    if ((await readdir(isolatedStore)).length !== 0) throw new Error('isolated pnpm store was not empty')
    const stagedRegistryPackages = await stageRegistryStore(storeDir, join(isolatedStore, 'v10'), lock.packages)
    const inventories = []
    for (let index = 0; index < roots.length; index += 1) {
      await makeBuildRoot(roots[index])
      await installFresh(roots[index], isolatedStore)
      await build(roots[index])
      const extracted = await packAndExtract(roots[index], join(temporary, 'repro-' + index))
      await verifyArtifact(extracted.packageRoot)
      inventories.push(await inventory(extracted.packageRoot))
    }
    if (JSON.stringify(inventories[0]) !== JSON.stringify(inventories[1])) throw new Error('packed artifacts differ across build roots')
    const consumer = join(temporary, 'consumer')
    await mkdir(consumer, { recursive: true })
    await cp(current.tarball, join(consumer, 'dsh-model-switch.tgz'))
    await cp(fixtureRoot, join(consumer, 'fixtures', 'alpha1'), { recursive: true, dereference: true })
    const sourceWorkspace = load(await readFile(join(sourceRoot, 'pnpm-workspace.yaml'), 'utf8'))
    await writeFile(join(consumer, 'package.json'), JSON.stringify(consumerManifest(archives), null, 2) + '\n')
    await writeFile(join(consumer, 'pnpm-workspace.yaml'), dump(await consumerWorkspace(archives, sourceWorkspace), { noRefs: true }))
    await writeFile(join(consumer, '.npmrc'), 'auto-install-peers=false\nnode-linker=hoisted\nbin-links=false\n')
    await run('pnpm', ['install', '--lockfile-only', '--offline', '--ignore-scripts', '--config.auto-install-peers=false', '--config.confirmModulesPurge=false', '--store-dir=' + storeDir, '--registry=https://registry.npmjs.org'], consumer)
    const consumerStagedRegistryPackages = await stageRegistryLock(storeDir, join(isolatedStore, 'v10'), join(consumer, 'pnpm-lock.yaml'))
    await installFresh(consumer, isolatedStore)
    await typecheckInstalledConsumer(consumer)
    await runInstalledSmokes(consumer)
    console.log('PACK_GATE files=' + currentEvidence.files + ' export_targets=' + currentEvidence.exports + ' local_packages=' + lock.localPackages + ' registry_packages=' + lock.registryPackages + ' locked_snapshots=' + lock.snapshots + ' locked_edges=' + lock.edges + ' duplicate_names=' + lock.duplicateNames.length + ' staged_registry_packages=' + stagedRegistryPackages + ' consumer_staged_registry_packages=' + consumerStagedRegistryPackages + ' roots=2 reproducible=true install=offline-invalid-registry isolated_store=true node_linker=hoisted symlinks=none owner_input_sha256=' + provenance.report.owner.input.sha256 + ' owner_provisional=' + String(provenance.report.owner.input.provisional) + ' plugin_artifact=' + current.tarball + ' plugin_artifact_bytes=' + current.bytes + ' plugin_artifact_sha256=' + current.sha256 + ' plugin_artifact_sha512=' + current.sha512)
  } catch (error) {
    primaryError = error
    throw error
  } finally {
    try {
      await safeRemove(temporary)
    } catch (cleanupError) {
      if (primaryError === undefined) throw cleanupError
      if (primaryError instanceof Error) Object.defineProperty(primaryError, 'cleanupError', { value: cleanupError, configurable: true })
    }
  }
}

await main()
