/** Read-only live replay check: open the dedicated native QA conversation in the isolated 9229 browser first. */
import assert from 'node:assert/strict'
const tabs = await (await fetch('http://127.0.0.1:9229/json')).json()
const tab = tabs.find(t => t.type === 'page' && new URL(t.url).origin === 'http://127.0.0.1:3082')
assert.ok(tab, 'Existing authenticated 3082 lab required')
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
async function evaluate(expression) {
  const key = ++id
  const response = new Promise(resolve => pending.set(key, resolve))
  ws.send(JSON.stringify({ id: key, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }))
  const message = await response
  assert.ok(!message.error && !message.result.exceptionDetails, 'Browser evaluation failed')
  return message.result.result.value
}
try {
  assert.equal(await evaluate('[...document.querySelectorAll("nav")].find(n=>n.getAttribute("aria-label")==="Session hierarchy")?.textContent.includes("Read the README.md file in")'), true, 'Open the dedicated QA conversation first')
  assert.equal(await evaluate('document.body.textContent.includes("Failed to load history")'), false, 'QA history must load before testing the runtime lock')
  if (!await evaluate('Boolean(document.querySelector("button[role=menuitemradio]"))')) {
    await evaluate('[...document.querySelectorAll("button")].find(b=>(b.getAttribute("aria-label")??"").startsWith("Select model")).click()')
    await evaluate('new Promise(r=>requestAnimationFrame(r))')
    await evaluate('[...document.querySelectorAll("button[role=menuitem]")].find(b=>b.textContent.startsWith("Model")).click()')
    await evaluate('new Promise(r=>requestAnimationFrame(r))')
  }
  const rows = await evaluate('[...document.querySelectorAll("button[role=menuitemradio]")].map(b=>({name:b.textContent.trim(),disabled:b.disabled}))')
  const llm = rows.filter(row => row.name.startsWith('DeepSeek'))
  const native = rows.filter(row => row.name.startsWith('Gemini'))
  assert.ok(llm.length > 0 && native.length > 0, 'Both LLM and native model groups must be present')
  assert.ok(llm.every(row => row.disabled), 'Logged native startup must disable LLM choices')
  assert.ok(native.every(row => !row.disabled), 'Native model choices must remain usable')
  console.log('PASS replayed native session locks LLM choices and preserves Antigravity model controls; no turn or model selection sent')
} finally { ws.close() }
