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
  it('shows only released Main and Subagent routes', () => {
    const markup = renderToStaticMarkup(<ModelSwitchSettings {...({
      t: (key: string) => key,
      capabilities: {
        centralSubagentRouting: { available: true },
      },
      setSubagent: vi.fn(),
      saveMain: vi.fn(),
    } as never)} />)

    expect(markup).toContain('>main<')
    expect(markup).toContain('>subagent<')
    expect(markup).not.toContain('>search<')
    expect(markup).not.toContain('>vision<')
    expect(markup).not.toContain('>image<')
  })
})
