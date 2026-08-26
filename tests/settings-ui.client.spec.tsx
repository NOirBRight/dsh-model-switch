import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ModelSwitchSettings } from '../src/client/ModelSwitchSettings.js'

vi.mock('../src/client/main-row-controller.js', () => ({
  deriveRouteChoices: () => ({ providers: [], models: [] }),
  useModelSwitchSettingsController: () => ({
    main: snapshot({ provider: 'codex', model: 'gpt-main' }),
    subagent: snapshot({ mode: 'fixed', provider: 'codex', model: 'gpt-subagent' }),
    draft: { provider: 'codex', model: 'gpt-main' },
    groups: [],
    providers: [],
    models: [],
    efforts: [],
    busy: false,
    disabled: false,
    setProvider: vi.fn(),
    setModel: vi.fn(),
    setReasoningEffort: vi.fn(),
    reset: vi.fn(),
    save: vi.fn(),
  }),
}))

function snapshot<T>(value: T) {
  return { status: 'ready' as const, value, base: {}, user: {}, revision: 1, writable: true, mode: 'host' as const }
}

describe('Model Switch settings menu', () => {
  it('shows Main, Subagent, Search, and Image without Vision', () => {
    const markup = renderToStaticMarkup(<ModelSwitchSettings {...({
      t: (key: string) => key,
      capabilities: {
        centralSubagentRouting: { available: true },
        searchProviderAdapters: { available: true, providers: ['codex'] },
        imageProviderAdapters: { available: true, providers: ['codex', 'grok'] },
      },
      useSearchSettings: () => snapshot({ provider: 'codex', model: 'gpt-search' }),
      useImageSettings: () => snapshot({ provider: 'grok', model: 'grok-imagine-image-quality' }),
      setSubagent: vi.fn(),
      setCapability: vi.fn(),
      saveMain: vi.fn(),
    } as never)} />)

    expect(markup).toContain('>main<')
    expect(markup).toContain('>subagent<')
    expect(markup).toContain('>search<')
    expect(markup).not.toContain('>vision<')
    expect(markup).toContain('>image<')
    expect(markup).not.toContain('>save<')
    expect(markup).not.toContain('aria-expanded="true"')
  })
})
