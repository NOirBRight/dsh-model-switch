import { afterEach, describe, expect, it, vi } from 'vitest'
import { installModelSwitchNavIcon } from '../src/client/nav-icon.ts'

class FakeEl {
  readonly tagName: string
  parentElement: FakeEl | null = null
  readonly children: FakeEl[] = []
  textContent = ''
  innerHTML = ''
  private readonly attrs = new Map<string, string>()

  constructor(tagName: string) { this.tagName = tagName.toUpperCase() }
  setAttribute(name: string, value: string): void { this.attrs.set(name, value) }
  getAttribute(name: string): string | null { return this.attrs.get(name) ?? null }
  append(...nodes: FakeEl[]): void {
    for (const node of nodes) { node.parentElement = this; this.children.push(node) }
  }
  matches(selector: string): boolean { return !selector.includes(' ') && this.tagName === selector.toUpperCase() }
  closest(selector: string): FakeEl | null {
    let current: FakeEl | null = this
    while (current !== null) { if (current.matches(selector)) return current; current = current.parentElement }
    return null
  }
  querySelector(selector: string): FakeEl | null { return this.querySelectorAll(selector)[0] ?? null }
  querySelectorAll(selector: string): FakeEl[] {
    const found: FakeEl[] = []
    const visit = (node: FakeEl): void => {
      for (const child of node.children) {
        if (child.matches(selector) || (selector === 'nav button' && child.tagName === 'BUTTON' && child.closest('nav'))) found.push(child)
        visit(child)
      }
    }
    visit(this)
    if (selector === 'nav button' && this.tagName === 'BUTTON' && this.closest('nav')) found.unshift(this)
    return found
  }
}

class FakeObserver {
  static instances: FakeObserver[] = []
  constructor(readonly callback: MutationCallback) { FakeObserver.instances.push(this) }
  observe(): void {}
  disconnect(): void {}
  takeRecords(): MutationRecord[] { return [] }
  deliver(records: MutationRecord[]): void { this.callback(records, this as unknown as MutationObserver) }
}

function record(target: FakeEl): MutationRecord {
  return { type: 'childList', target: target as unknown as Node, addedNodes: [] as unknown as NodeList, removedNodes: [] as unknown as NodeList, previousSibling: null, nextSibling: null, attributeName: null, attributeNamespace: null, oldValue: null }
}

function modelSwitchNav(): { nav: FakeEl; button: FakeEl; svg: FakeEl } {
  const nav = new FakeEl('nav')
  const button = new FakeEl('button')
  const svg = new FakeEl('svg')
  const label = new FakeEl('span')
  label.textContent = 'Model Switch'
  button.append(svg, label)
  nav.append(button)
  return { nav, button, svg }
}

let frames: FrameRequestCallback[] = []
function flush(): void { for (const frame of frames.splice(0)) frame(0) }

function stubDom(button: FakeEl): void {
  FakeObserver.instances = []
  frames = []
  vi.stubGlobal('Element', FakeEl)
  vi.stubGlobal('MutationObserver', FakeObserver)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('document', { body: {}, querySelectorAll: (selector: string) => selector === 'nav button' ? [button] : [] })
}

afterEach(() => { vi.unstubAllGlobals() })

describe('Model Switch settings nav icon', () => {
  it('restores the switch glyph after React redraws the marked svg as a gear', () => {
    const { nav, button, svg } = modelSwitchNav()
    stubDom(button)
    installModelSwitchNavIcon()
    expect(svg.innerHTML).toContain('M3 5.5')

    svg.innerHTML = '<path data-official-gear="true" />'
    FakeObserver.instances[0]!.deliver([record(nav)])
    flush()

    expect(svg.innerHTML).not.toContain('data-official-gear')
    expect(svg.innerHTML).toContain('M3 5.5')
  })
})
