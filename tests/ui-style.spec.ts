import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { en, zh } from '../src/client/locales.js'

const source = readFileSync(new URL('../src/client/ModelSwitchSettings.module.css', import.meta.url), 'utf8')

function block(selector: string): string {
  const start = source.indexOf(`${selector} {`)
  if (start < 0) return ''
  const end = source.indexOf('}', start)
  return source.slice(start, end + 1)
}

describe('Model Switch Settings UI contract', () => {
  it('uses the DSH theme vocabulary without a plugin-owned color palette', () => {
    for (const token of [
      '--dsw-alias-bg-layer-1',
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

  it('matches the shared LLM Provider card chrome', () => {
    expect(block('.routeCard')).toContain('overflow: hidden')
    expect(block('.routeCard')).toContain('border-radius: 10px')
    expect(block('.routeCard')).toContain('background: var(--dsw-alias-bg-module-platform)')
    expect(block('.routeCardOpen')).toBe('')

    expect(block('.routeHeader')).toContain('gap: 16px')
    expect(block('.routeHeader')).toContain('min-height: 68px')
    expect(block('.routeHeader')).toContain('padding: 12px 14px')

    expect(block('.routeIcon')).toContain('width: 18px')
    expect(block('.routeIcon')).toContain('height: 18px')
    expect(block('.routeIcon')).not.toContain('background:')

    expect(block('.routeCopy')).toContain('gap: 4px')
    expect(block('.routeName')).toContain('gap: 8px')
    expect(block('.routeName')).toContain('font-size: 14px')
    expect(block('.routeName')).toContain('line-height: 20px')
    expect(block('.routeName')).toContain('font-weight: 600')
    expect(block('.routeSummary')).toContain('font-size: 13px')
    expect(block('.routeSummary')).toContain('line-height: 18px')

    expect(block('.chevron')).toContain('width: 18px')
    expect(block('.chevron')).toContain('height: 18px')
    expect(block('.cardBody')).toContain('padding: 16px 14px 18px')
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
