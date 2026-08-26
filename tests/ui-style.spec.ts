import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { en, zh } from '../src/client/locales.js'

const source = readFileSync(new URL('../src/client/ModelSwitchSettings.module.css', import.meta.url), 'utf8')

describe('Model Switch Settings UI contract', () => {
  it('uses the DSH theme vocabulary without a plugin-owned color palette', () => {
    for (const token of [
      '--dsw-alias-bg-layer-1',
      '--dsw-alias-bg-layer-2',
      '--dsw-alias-bg-layer-3',
      '--dsw-alias-bg-module-platform',
      '--dsw-alias-label-primary',
      '--dsw-alias-label-secondary',
      '--dsw-alias-label-tertiary',
      '--dsw-alias-border-l2',
      '--dsw-alias-brand-primary',
      '--dsw-alias-button-primary-fill',
    ]) expect(source).toContain(`var(${token})`)
    expect(source.replace(/url\([^)]*\)/g, '')).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i)
  })

  it('collapses route forms at the narrow overlay boundary', () => {
    expect(source).toContain('container-type: inline-size')
    expect(source).toContain('@container (max-width: 420px)')
    expect(source).toContain('.formGrid { grid-template-columns: 1fr; }')
  })

  it('removes the obsolete preset and tool-ownership rows from both locales', () => {
    expect(zh).not.toHaveProperty('presets')
    expect(zh).not.toHaveProperty('toolOwnership')
    expect(en).not.toHaveProperty('presets')
    expect(en).not.toHaveProperty('toolOwnership')
  })
})
