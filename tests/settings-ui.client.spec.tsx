import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ModelSwitchSettings } from '../src/client/ModelSwitchSettings.js'
import { useModelSwitchSettingsController } from '../src/client/main-row-controller.js'
import { en, zh } from '../src/client/locales.js'

vi.mock('../src/client/main-row-controller.js', () => ({
  deriveRouteChoices: () => ({ providers: [], models: [] }),
  selectRouteModel: () => ({ provider: 'codex', model: 'gpt-subagent' }),
  useModelSwitchSettingsController: vi.fn(),
}))

function snapshot<T>(value: T) {
  return { status: 'ready' as const, value, base: {}, user: {}, revision: 1, writable: true, mode: 'host' as const }
}

const controller = (subagent: { mode: 'follow-main' | 'fixed'; provider?: string; model?: string }) => ({
  main: snapshot({ provider: 'codex', model: 'gpt-main' }),
  subagent: snapshot(subagent),
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
})

function renderSettings(options?: {
  subagent?: { mode: 'follow-main' | 'fixed'; provider?: string; model?: string }
  compactOnSwitch?: boolean
  setSubagent?: ReturnType<typeof vi.fn>
  setCompactOnSwitch?: ReturnType<typeof vi.fn>
}) {
  vi.mocked(useModelSwitchSettingsController).mockReturnValue(controller(options?.subagent ?? { mode: 'fixed', provider: 'codex', model: 'gpt-subagent' }) as never)
  return renderToStaticMarkup(<ModelSwitchSettings {...({
    t: (key: string) => key,
    capabilities: {
      centralSubagentRouting: { available: true },
      searchProviderAdapters: { available: true, providers: ['codex'] },
      imageProviderAdapters: { available: true, providers: ['codex', 'grok'] },
    },
    useSearchSettings: () => snapshot({ provider: 'codex', model: 'gpt-search' }),
    useImageSettings: () => snapshot({ provider: 'grok', model: 'grok-imagine-image-quality' }),
    useSwitchSettings: () => snapshot({ compactOnSwitch: options?.compactOnSwitch !== false }),
    setSubagent: options?.setSubagent ?? vi.fn(),
    setCapability: vi.fn(),
    setCompactOnSwitch: options?.setCompactOnSwitch ?? vi.fn(),
    saveMain: vi.fn(),
  } as never)} />)
}

describe('Model Switch settings menu', () => {
  it('shows Send protection B-row and Subagent RouteCard without a follow-main select', () => {
    const markup = renderSettings()

    expect(markup).toContain('>main<')
    expect(markup).toContain('>subagent<')
    expect(markup).toContain('>search<')
    expect(markup).not.toContain('>vision<')
    expect(markup).toContain('>image<')
    expect(markup).toContain('>sendProtection<')
    expect(markup).toContain('compactOnSwitch')
    expect(markup).toContain('role="switch"')
    expect(markup).toContain('aria-label="compactOnSwitch"')
    expect(markup).toContain('aria-label="subagent"')
    expect(markup).not.toContain('type="checkbox"')
    expect(markup).not.toContain('>save<')
    expect(markup).not.toContain('aria-expanded="true"')
    expect(markup).not.toContain('subagentMode')
    expect(markup).not.toContain('follow-main')
    expect(markup).not.toContain('subagentFollowMain')
    expect(markup.indexOf('sendProtection')).toBeLessThan(markup.indexOf('conversationRoutes'))
  })

  it('keeps the Subagent card collapsed and labelled Official inherit when the default is off', () => {
    const markup = renderSettings({ subagent: { mode: 'follow-main', provider: 'codex', model: 'gpt-subagent' } })
    expect(markup).toContain('>subagentOff<')
    expect(markup).not.toContain('aria-expanded="true"')
    expect(markup).toContain('>sendProtection<')
    expect(markup).toContain('role="switch"')
  })

  it('treats missing compactOnSwitch as on in the Send protection switch', () => {
    vi.mocked(useModelSwitchSettingsController).mockReturnValue(controller({ mode: 'fixed', provider: 'codex', model: 'gpt-subagent' }) as never)
    const markup = renderToStaticMarkup(<ModelSwitchSettings {...({
      t: (key: string) => key,
      capabilities: {
        centralSubagentRouting: { available: true },
        searchProviderAdapters: { available: true, providers: ['codex'] },
        imageProviderAdapters: { available: true, providers: ['codex', 'grok'] },
      },
      useSearchSettings: () => snapshot({ provider: 'codex', model: 'gpt-search' }),
      useImageSettings: () => snapshot({ provider: 'grok', model: 'grok-imagine-image-quality' }),
      useSwitchSettings: () => snapshot({}),
      setSubagent: vi.fn(),
      setCapability: vi.fn(),
      setCompactOnSwitch: vi.fn(),
      saveMain: vi.fn(),
    } as never)} />)
    const compact = markup.match(/<button[^>]*aria-label="compactOnSwitch"[^>]*>/)?.[0]
    expect(compact).toContain('aria-checked="true"')
    expect(compact).toContain('role="switch"')
  })

  it('shows compact off when compactOnSwitch is false', () => {
    const markup = renderSettings({ compactOnSwitch: false })
    const compact = markup.match(/<button[^>]*aria-label="compactOnSwitch"[^>]*>/)?.[0]
    expect(compact).toContain('aria-checked="false"')
  })

  it('keeps zh/en copy for Send protection and the Subagent Allowlist hint', () => {
    expect(zh.sendProtection).toBe('发送保护')
    expect(en.sendProtection).toBe('Send protection')
    expect(zh.subagentHelp).toContain('白名单')
    expect(en.subagentHelp).toContain('Allowlist')
    expect(zh.subagentHelp).not.toMatch(/href=|settings\./)
    expect(en.subagentHelp).not.toMatch(/href=|settings\./)
    expect(zh.compactOnSwitchHelp).toContain('发送且换了模型')
    expect(en.compactOnSwitchHelp).toContain('/compact')
    expect(zh).not.toHaveProperty('subagentFollowMain')
    expect(en).not.toHaveProperty('subagentFollowMain')
  })
})
