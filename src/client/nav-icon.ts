/** Official settings.section has no icon field. Swap the default gear for a model-switch glyph. */

const LABELS = new Set(['Model Switch', '模型切换'])
const MARK = 'data-dsh-ms-icon'
const GLYPH = [
  '<path d="M3 5.5h7.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  '<path d="M10.2 5.5 8.4 3.7M10.2 5.5 8.4 7.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  '<path d="M13 10.5H5.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  '<path d="M5.8 10.5 7.6 8.7M5.8 10.5 7.6 12.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
].join('')

function patch(): void {
  for (const button of Array.from(document.querySelectorAll('nav button'))) {
    const label = Array.from(button.querySelectorAll('span')).find(span => LABELS.has(span.textContent?.trim() ?? ''))
    if (label === undefined) continue
    const svg = button.querySelector('svg')
    if (svg === null || svg.getAttribute(MARK) === 'switch') continue
    svg.setAttribute(MARK, 'switch')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('fill', 'none')
    svg.innerHTML = GLYPH
  }
}

function touchesSettingsNav(node: Node): boolean {
  if (!(node instanceof Element)) return false
  if (node.closest('nav') !== null || node.querySelector('nav') !== null) return true
  const buttons = node.matches('button')
    ? [node, ...Array.from(node.querySelectorAll('button'))]
    : Array.from(node.querySelectorAll('button'))
  for (const button of buttons) {
    for (const span of Array.from(button.querySelectorAll('span'))) {
      if (LABELS.has(span.textContent?.trim() ?? '')) return true
    }
  }
  return false
}

/** Keep the Model Switch nav glyph in place across Settings re-renders. */
export function installModelSwitchNavIcon(): () => void {
  if (typeof document === 'undefined' || document.body === null) return () => {}
  let frame = 0
  const observer = new MutationObserver((records) => {
    if (!records.some(record => touchesSettingsNav(record.target) || Array.from(record.addedNodes).some(touchesSettingsNav))) return
    if (frame !== 0) return
    frame = requestAnimationFrame(() => {
      frame = 0
      patch()
      observer.takeRecords()
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })
  patch()
  observer.takeRecords()
  return () => {
    observer.disconnect()
    if (frame !== 0) cancelAnimationFrame(frame)
  }
}
