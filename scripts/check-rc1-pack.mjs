#!/usr/bin/env node

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const work = mkdtempSync(join(root, 'node_modules', '.dsh-pack-'))

try {
  const [report] = JSON.parse(execFileSync('npm', [
    'pack', '--json', '--ignore-scripts', '--pack-destination', work,
  ], { cwd: root, encoding: 'utf8' }))
  assert(report?.filename, 'npm pack did not produce an archive')
  const archive = join(work, report.filename)
  const names = new Set(execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n'))
  execFileSync('tar', ['-xzf', archive, '-C', work])
  const packedDir = join(work, 'package')
  const packed = JSON.parse(readFileSync(join(packedDir, 'package.json'), 'utf8'))
  assert.equal(packed.name, source.name)
  assert.equal(packed.version, source.version)
  assert.equal(packed.dsh?.compatibility?.dshReleases?.['0.1.7-rc.1'], 'compatible')

  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies']) {
    for (const [name, range] of Object.entries(packed[section] ?? {})) {
      assert.doesNotMatch(range, /^(?:file|link|workspace|npm):|^\//u, `${section}.${name} must not use a local dependency`)
      if (name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-')) {
        assert.match(range, /^>=\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u, `${section}.${name} must have no upper version bound`)
      }
    }
  }
  for (const entry of Object.values(packed.exports ?? {})) {
    for (const target of typeof entry === 'string' ? [entry] : Object.values(entry)) {
      assert(names.has(`package/${target.replace(/^\.\//u, '')}`), `missing export ${target}`)
    }
  }
  for (const file of ['cordis.patch.yml', 'README.md', 'README.zh.md', 'lib/index.js', 'lib/client.js']) {
    assert(names.has(`package/${file}`), `missing ${file}`)
  }
  assert(names.has('package/package.json'))
  assert(![...names].some(name => name.includes('/../') || /(?:^|\/)\.env(?:\.|$)/u.test(name)), 'unsafe archive member')

  symlinkSync(join(root, 'node_modules'), join(packedDir, 'node_modules'), 'dir')
  const host = await import(pathToFileURL(join(packedDir, 'lib/index.js')).href)
  assert(typeof host.apply === 'function' || typeof host.default === 'function' || typeof host.name === 'string', 'Host export missing')
  const registrations = []
  globalThis.window = { __ModuleLoader__: { load(value) { registrations.push(value) } } }
  await import(pathToFileURL(join(packedDir, 'lib/client.js')).href)
  assert.equal(registrations.length, 1, 'Web client registration missing')
  assert.equal(registrations[0].id, packed.name)
  assert.equal(typeof registrations[0].factory, 'function')
  console.log(`pack check passed: ${report.filename}`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
