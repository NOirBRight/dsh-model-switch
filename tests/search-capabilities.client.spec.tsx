import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { Profiler } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ModelSwitchSettings } from '../src/client/ModelSwitchSettings.js'
import { decodeCapabilitiesSnapshot, searchGroupsFromCapabilities } from '../src/client/search-capabilities.js'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function snapshot<T>(value: T) {
  return { status: 'ready' as const, value, base: {}, user: {}, revision: 1, writable: true, mode: 'host' as const }
}

// Render-stable controller state: fresh objects per render would retrigger draft effects forever.
let controllerState: ReturnType<typeof buildControllerState> | undefined
function buildControllerState() {
  return {
    main: snapshot({ provider: 'codex', model: 'gpt-main' }),
    subagent: snapshot({ mode: 'follow-main' }),
    draft: { provider: 'codex', model: 'gpt-main' },
    // Conversational decoy: the search card must never render it once the Host loader exists.
    groups: [{ id: 'codex', name: 'Codex Conversational', models: [{ id: 'chat-only', name: 'Chat Only' }] }],
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
  }
}

vi.mock('../src/client/main-row-controller.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/client/main-row-controller.js')>()
  return {
    ...actual,
    useModelSwitchSettingsController: () => (controllerState ??= buildControllerState()),
  }
})

function faceProps(loadCapabilities: unknown) {
  // Stable hook snapshots: the component reads them every render, so they must keep identity.
  const searchSettings = snapshot({ provider: 'codex', model: 'gpt-search' })
  const imageSettings = snapshot({ provider: 'grok', model: 'grok-imagine-image-quality' })
  return {
    t: (key: string) => key,
    capabilities: {
      centralSubagentRouting: { available: true },
      searchProviderAdapters: { available: false, reason: 'search-provider-adapters', providers: [] },
      imageProviderAdapters: { available: true, providers: ['codex', 'grok'] },
    },
    useSearchSettings: (selector: (value: unknown) => unknown) => selector(searchSettings),
    useImageSettings: (selector: (value: unknown) => unknown) => selector(imageSettings),
    setSubagent: vi.fn(),
    setCapability: vi.fn(),
    saveMain: vi.fn(),
    loadCapabilities,
  } as never
}

function textOf(renderer: ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON())
}

function optionText(option: { children?: readonly unknown[] }): string {
  return (option.children ?? []).join('')
}

function instanceText(node: { children?: readonly unknown[] }): string {
  return (node.children ?? []).map(child => typeof child === 'string' ? child : instanceText(child as { children?: readonly unknown[] })).join('')
}

function openCard(renderer: ReactTestRenderer, summary: string): void {
  const button = renderer.root.findAllByType('button').find(candidate => candidate.props.disabled !== true && instanceText(candidate).includes(summary))
  if (button === undefined) throw new Error('card not found: ' + summary)
  button.props.onClick()
}

function searchOptions(renderer: ReactTestRenderer): { values: unknown[]; texts: string[]; disabled: unknown[] } {
  const selects = renderer.root.findAllByType('select')
  expect(selects).toHaveLength(2)
  const options = selects.flatMap(select => select.findAllByType('option'))
  return { values: options.map(option => option.props.value), texts: options.map(optionText), disabled: selects.map(select => select.props.disabled) }
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => { setTimeout(resolve, ms) })

describe('search capability metadata', () => {
  it('decodes Host snapshots and drops untrusted extras', () => {
    const snapshot = decodeCapabilitiesSnapshot({ revision: 2, capabilities: { searchProviderAdapters: { available: true, providers: ['codex'], catalog: [{ id: 'codex', name: 'Codex', models: [{ id: 'gpt-search', name: 'GPT Search' }], search: async () => ({}), token: 'secret' }] } } })
    expect(snapshot?.revision).toBe(2)
    expect(snapshot?.capabilities.searchProviderAdapters.providers).toEqual(['codex'])
    expect(snapshot?.capabilities.searchProviderAdapters.catalog).toEqual([{ id: 'codex', name: 'Codex', models: [{ id: 'gpt-search', name: 'GPT Search' }] }])
  })

  it('rejects revisions and shapes that cannot be trusted', () => {
    expect(decodeCapabilitiesSnapshot({ revision: -1, capabilities: {} })).toBeUndefined()
    expect(decodeCapabilitiesSnapshot({ revision: 1.5, capabilities: {} })).toBeUndefined()
    expect(decodeCapabilitiesSnapshot({ capabilities: {} })).toBeUndefined()
    expect(decodeCapabilitiesSnapshot({ revision: 0, capabilities: { searchProviderAdapters: { available: 'yes' } } })).toBeUndefined()
    expect(decodeCapabilitiesSnapshot(null)).toBeUndefined()
  })

  it('fails the whole snapshot on a malformed search entry when available', () => {
    expect(decodeCapabilitiesSnapshot({ revision: 1, capabilities: { searchProviderAdapters: { available: true, providers: ['codex'], catalog: [{ id: 'codex', name: 'Codex', models: [{ id: 'gpt-search' }] }] } } })).toBeUndefined()
    expect(decodeCapabilitiesSnapshot({ revision: 1, capabilities: { searchProviderAdapters: { available: true, catalog: 'codex' } } })).toBeUndefined()
  })

  it('projects Host catalog to groups without inventing entries', () => {
    expect(searchGroupsFromCapabilities(undefined)).toEqual([])
    expect(searchGroupsFromCapabilities({ searchProviderAdapters: { available: true, providers: [], catalog: [] } } as never)).toEqual([])
  })
})

describe('search settings UI seam', () => {
  it.each([false, true])('recovers after three metadata failures without remount (previously loaded: %s)', async loaded => {
    vi.useFakeTimers()
    const host = { revision: 0, capabilities: { searchProviderAdapters: { available: true, providers: ['codex'], catalog: [{ id: 'codex', name: 'Codex', models: [{ id: 'gpt-search', name: 'GPT Search' }] }] } } }
    const load = vi.fn(() => new Promise(() => {}))
    if (loaded) load.mockResolvedValueOnce(host)
    load.mockRejectedValueOnce(new Error('catalogFailed')).mockRejectedValueOnce(new Error('catalogFailed')).mockRejectedValueOnce(new Error('catalogFailed')).mockResolvedValueOnce(host)
    let renderer!: ReactTestRenderer
    try {
      await act(async () => { renderer = create(<ModelSwitchSettings {...faceProps(load)} />) })
      if (loaded) await act(async () => { openCard(renderer, 'Codex · GPT Search') })
      await act(async () => { await vi.advanceTimersByTimeAsync(750) })
      expect(textOf(renderer)).toContain('catalogFailed')
      if (loaded) expect(searchOptions(renderer).disabled).toEqual([true, true])
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      expect(textOf(renderer)).not.toContain('catalogFailed')
      if (!loaded) await act(async () => { openCard(renderer, 'Codex · GPT Search') })
      expect(searchOptions(renderer).texts).toContain('GPT Search')
      expect(searchOptions(renderer).disabled).toEqual([false, false])
    } finally {
      await act(async () => { renderer?.unmount() })
      const pendingTimers = vi.getTimerCount()
      vi.useRealTimers()
      expect(pendingTimers).toBe(0)
    }
  })

  it('ignores identical heartbeats but accepts changed metadata with a reused revision', async () => {
    const host = { revision: 0, capabilities: { searchProviderAdapters: { available: true, providers: ['codex'], catalog: [{ id: 'codex', name: 'Codex', models: [{ id: 'gpt-search', name: 'GPT Search' }] }] } } }
    const replacement = structuredClone(host)
    replacement.capabilities.searchProviderAdapters.catalog[0]!.name = 'Reloaded Codex'
    let resolveNext!: (value: unknown) => void
    const load = vi.fn(() => new Promise(resolve => { resolveNext = resolve })).mockResolvedValueOnce(host)
    const rendered = vi.fn()
    let renderer!: ReactTestRenderer
    try {
      await act(async () => { renderer = create(<Profiler id="search" onRender={rendered}><ModelSwitchSettings {...faceProps(load)} /></Profiler>) })
      await act(async () => { openCard(renderer, 'Codex · GPT Search') })
      rendered.mockClear()
      await act(async () => { resolveNext(structuredClone(host)) })
      expect(rendered).not.toHaveBeenCalled()
      await act(async () => { resolveNext(replacement) })
      expect(searchOptions(renderer).texts).toContain('Reloaded Codex')
    } finally { await act(async () => { renderer?.unmount() }) }
  })

  it('stays fail-closed until the Host catalog loads, then tracks unload with warnings', async () => {
    const seen: unknown[][] = []
    let resolveFirst!: (value: unknown) => void
    let resolveSecond!: (value: unknown) => void
    const loadCapabilities = vi.fn((...args: unknown[]) => {
      seen.push(args)
      if (seen.length === 1) return new Promise(resolve => { resolveFirst = resolve })
      if (seen.length === 2) return new Promise(resolve => { resolveSecond = resolve })
      return Promise.reject(new Error('catalogFailed'))
    })
    let renderer!: ReactTestRenderer
    await act(async () => { renderer = create(<ModelSwitchSettings {...faceProps(loadCapabilities)} />) })
    // Initial loading is fail-closed: no Host names, search unavailable.
    expect(loadCapabilities).toHaveBeenCalledTimes(1)
    expect(seen[0]?.[0]).toBeUndefined()
    expect(seen[0]?.[1]).toBeInstanceOf(AbortSignal)
    expect(textOf(renderer)).toContain('unavailable')
    expect(textOf(renderer)).not.toContain('GPT Search')
    // Late Host catalog arrives; the next long-poll carries the revision.
    await act(async () => { resolveFirst({ revision: 1, capabilities: { searchProviderAdapters: { available: true, providers: ['codex'], catalog: [{ id: 'codex', name: 'Codex', models: [{ id: 'gpt-search', name: 'GPT Search' }] }] } } }) })
    expect(loadCapabilities).toHaveBeenCalledTimes(2)
    expect(seen[1]?.[0]).toBe(1)
    await act(async () => { openCard(renderer, 'Codex \u00b7 GPT Search') })
    const loaded = searchOptions(renderer)
    expect(loaded.values).toEqual(['', 'codex', '', 'gpt-search'])
    expect(loaded.texts).toContain('Codex')
    expect(loaded.texts).toContain('GPT Search')
    expect(loaded.texts).not.toContain('Codex Conversational')
    expect(loaded.texts).not.toContain('Chat Only')
    // Provider unloads: an empty Host catalog keeps the stored route visible with a warning.
    await act(async () => { resolveSecond({ revision: 2, capabilities: { searchProviderAdapters: { available: true, providers: [], catalog: [] } } }) })
    expect(loadCapabilities).toHaveBeenCalledTimes(3)
    const unloaded = searchOptions(renderer)
    expect(unloaded.values).toEqual(['', 'codex', '', 'gpt-search'])
    expect(renderer.root.findAllByType('button').find(button => button.children.includes('save'))?.props.disabled).toBe(true)
    expect(unloaded.texts.some(text => text.includes('codex') && text.includes('\u26a0'))).toBe(true)
    expect(unloaded.texts.some(text => text.includes('gpt-search') && text.includes('\u26a0'))).toBe(true)
    // Unmount cancels the pending long-poll: no further calls after teardown.
    await act(async () => { renderer.unmount(); await sleep(400) })
    expect(loadCapabilities).toHaveBeenCalledTimes(3)
  })

  it('stays fail-closed when the capabilities call fails', async () => {
    const loadCapabilities = vi.fn(async () => { throw new Error('catalogFailed') })
    let renderer!: ReactTestRenderer
    await act(async () => { renderer = create(<ModelSwitchSettings {...faceProps(loadCapabilities)} />) })
    expect(textOf(renderer)).toContain('unavailable')
    expect(textOf(renderer)).not.toContain('GPT Search')
    await act(async () => { renderer.unmount() })
  })

  it('disables stale search metadata after bounded long-poll failures', async () => {
    let calls = 0
    const loadCapabilities = vi.fn(async () => {
      calls += 1
      if (calls === 1) return { revision: 1, capabilities: { searchProviderAdapters: { available: true, providers: ['codex'], catalog: [{ id: 'codex', name: 'Codex', models: [{ id: 'gpt-search', name: 'GPT Search' }] }] } } }
      throw new Error('catalogFailed')
    })
    let renderer!: ReactTestRenderer
    await act(async () => { renderer = create(<ModelSwitchSettings {...faceProps(loadCapabilities)} />) })
    await act(async () => { openCard(renderer, 'Codex \u00b7 GPT Search') })
    expect(renderer.root.findAllByType('select').map(select => select.props.disabled)).toEqual([false, false])
    await act(async () => { await sleep(1300) })
    expect(calls).toBe(4)
    expect(renderer.root.findAllByType('select').map(select => select.props.disabled)).toEqual([true, true])
    expect(textOf(renderer)).toContain('catalogFailed')
    expect(renderer.root.findAllByType('button').find(button => button.children.includes('save'))?.props.disabled).toBe(true)
    await act(async () => { renderer.unmount() })
  })
})
