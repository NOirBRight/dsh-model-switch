/** Read-only public-stream checks of the dedicated 3082 native execution QA sessions. */
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
  if (message.error) throw new Error(message.error.message)
  assert.ok(!message.result.exceptionDetails, 'Browser evaluation failed')
  return message.result.result.value
}

function snapshotInBrowser(address) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/remote.mux', location.origin)
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(url)
    const streamId = crypto.randomUUID()
    const timer = setTimeout(() => { socket.close(); reject(Error('History stream timeout')) }, 20000)
    const close = () => { clearTimeout(timer); socket.close() }
    socket.onopen = () => socket.send(JSON.stringify({ type: 'open', streamId, endpoint: 'session/follow', payload: { args: { request: { address, maxMessages: 100 } } } }))
    socket.onerror = () => { close(); reject(Error('History stream failed')) }
    socket.onmessage = event => {
      const message = JSON.parse(event.data)
      if (message.type === 'item' && message.value.type === 'snapshot') {
        socket.send(JSON.stringify({ type: 'cancel', streamId }))
        close(); resolve(message.value)
      } else if (message.type === 'error') { close(); reject(Error('History stream rejected')) }
    }
  })
}
async function events(address) {
  const snapshot = await evaluate('(' + snapshotInBrowser.toString() + ')(' + JSON.stringify(address) + ')')
  assert.equal(snapshot.hasMore, false, 'The complete QA prefix is required')
  return snapshot.records.filter(row => row.type === 'event').map(row => row.event)
}
const headers = records => records.filter(event => event.type === 'request/header').map(event => event.data.header.config)
const endings = records => records.filter(event => event.type === 'turn/end').map(event => event.data.reason)
const text = records => records.filter(event => event.type === 'assistant/message').flatMap(event => event.data.message.content).filter(block => block.type === 'text').map(block => block.text).join(' ')
try {
  const native = await events({ kind: 'session', sessionId: 'session-47e76b8d-cd8b-46ca-a517-9b90e700c62b' })
  assert.ok(endings(native).some(reason => reason.kind === 'error' && reason.error.code === 'ACTIVITY_BINDING_REJECTED'))
  assert.equal(headers(native).at(-1).provider, 'antigravity')
  assert.equal(endings(native).at(-1).kind, 'completed')
  assert.ok(text(native).includes('NATIVE_RESUME_QA_OK'))
  assert.ok(native.every(event => !event.type.startsWith('antigravity/')), 'Native extensions do not belong in Core logs')
  const parent = await events({ kind: 'session', sessionId: 'session-4388b6cf-8732-4f1b-b2e6-649f465fc93c' })
  const child = await events({ kind: 'subagent', parentSessionId: 'session-4388b6cf-8732-4f1b-b2e6-649f465fc93c', childSessionId: '6067b4e1-f055-4a5c-b389-ccc627a70a40', mode: 'one-shot' })
  assert.equal(headers(parent).at(-1).provider, 'deepseek-official')
  assert.equal(headers(child).at(-1).provider, 'antigravity')
  assert.equal(endings(parent).at(-1).kind, 'completed')
  assert.equal(endings(child).at(-1).kind, 'completed')
  assert.ok(text(parent).includes('DSH_PARENT_NATIVE_CHILD_QA_OK NATIVE_CHILD_QA_OK'))
  assert.equal(text(child), 'NATIVE_CHILD_QA_OK')
  const settings = await evaluate('fetch("/api/settings/describe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"client-request",rpcId:crypto.randomUUID(),method:"settings/describe",payload:{args:{}}})}).then(r=>r.json()).then(r=>r.result.value.namespaces.find(n=>n.ns==="model-switch"))')
  assert.equal(settings.value.subagentMode, 'follow-main')
  for (const key of ['subagentMode', 'subagentProvider', 'subagentModel', 'subagentReasoningEffort']) assert.equal(Object.hasOwn(settings.user, key), false)
  console.log('PASS: durable guard rejection, native continuation, DSH-parent/native-child completion, and restored subagent preferences.')
} finally { ws.close() }
