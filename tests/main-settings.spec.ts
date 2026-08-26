import { describe, expect, it } from 'vitest'
import { parseMainSettingsDocument, routeForNewSession } from '../src/main-settings.js'
import { catalog } from './fixtures.js'

describe('Main settings document', () => {
  it('parses the versioned document without hiding unavailable choices', () => {
    expect(parseMainSettingsDocument({ version: 1, defaultRoute: { provider: 'uninstalled', model: 'remember-me', reasoningEffort: 'custom' } }))
      .toEqual({ version: 1, defaultRoute: { provider: 'uninstalled', model: 'remember-me', reasoningEffort: 'custom' } })
  })
  it('rejects malformed documents but defers catalog availability until use', () => {
    expect(() => parseMainSettingsDocument({ version: 2, defaultRoute: {} })).toThrow('version')
    const unavailable = parseMainSettingsDocument({ version: 1, defaultRoute: { provider: 'deepseek', model: 'missing' } })
    expect(() => routeForNewSession(catalog, unavailable)).toThrow('unknown model')
  })
  it('copies defaults only when a caller creates a new session', () => {
    const settings = parseMainSettingsDocument({ version: 1, defaultRoute: { provider: 'deepseek', model: 'deep-chat' } })
    const first = routeForNewSession(catalog, settings)
    settings.defaultRoute = { provider: 'codex', model: 'codex-chat', reasoningEffort: 'ultra' }
    expect(first).toEqual({ provider: 'deepseek', model: 'deep-chat', reasoningEffort: 'off' })
    expect(routeForNewSession(catalog, settings)).toEqual({ provider: 'codex', model: 'codex-chat', reasoningEffort: 'ultra' })
  })
})
