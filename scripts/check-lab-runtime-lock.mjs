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
  if (message.error) throw new Error(message.error.message)
  assert.ok(!message.result.exceptionDetails, 'Browser evaluation failed')
  return message.result.result.value
}
const mode = process.argv[2] ?? 'native'
assert.ok(['native', 'runtime-absent', 'plugin-absent'].includes(mode))
async function rpc(method, payload = {}) {
  const reply = await evaluate('fetch(' + JSON.stringify('/dsh-acp-antigravity/' + method) + ',{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(' + JSON.stringify({ type: 'client-request', rpcId: 'qa-history', method, payload }) + ')}).then(r=>r.json())')
  assert.equal(reply.result.ok, true, method + ' failed')
  return reply.result.value
}
try {
  for (let attempt = 0; ; attempt++) {
    try {
      await evaluate('new Promise((resolve,reject)=>{const end=Date.now()+20000;function check(){if([...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Chat"))resolve(true);else if(Date.now()>end)reject(Error("Chat unavailable"));else requestAnimationFrame(check)}check()})')
      break
    } catch (error) {
      if (attempt >= 2 || !/context.*destroyed|Cannot find context|Inspected target navigated or closed/i.test(error.message)) throw error
    }
  }
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Chat").click()')
  await evaluate('new Promise(r=>requestAnimationFrame(r))')
  assert.equal(await evaluate('document.body.textContent.split("NATIVE_HISTORY_QA_OK").length-1'), 2, 'The real prompt and reply must survive replay')
  assert.equal(await evaluate('[...document.querySelectorAll("nav")].find(n=>n.getAttribute("aria-label")==="Session hierarchy")?.textContent.includes("Native history compatibility QA")'), true, 'Open the dedicated QA conversation first')
  assert.equal(await evaluate('document.body.textContent.includes("Failed to load history")'), false, 'QA history must load before testing the runtime lock')
  if (mode === 'plugin-absent') {
    assert.equal(await evaluate('[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Antigravity Activity")'), false, 'Native client must actually be absent')
    assert.equal(await evaluate('fetch("/dsh-acp-antigravity/activity/binding",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"client-request",rpcId:"qa-absent",method:"activity/binding",payload:{sessionId:"session-47e76b8d-cd8b-46ca-a517-9b90e700c62b"}})}).then(r=>r.status)'), 405, 'Native RPC must match the Host unregistered-POST response')
  }
  if (mode !== 'plugin-absent') {
    const payload = { sessionId: 'session-47e76b8d-cd8b-46ca-a517-9b90e700c62b' }
    const history = await rpc('activity/read', payload)
    assert.equal(history.version, 1)
    assert.ok(history.records.some(row => row.type === 'antigravity/session-ready'))
    assert.ok(history.records.some(row => row.type === 'antigravity/tool-update'), 'Real native activity must survive replay')
    assert.equal((await rpc('activity/binding', payload)).provider, 'antigravity')
    if (mode === 'runtime-absent') assert.equal((await rpc('snapshot')).rows[0].installed, false)
  }
  if (mode !== 'native') {
    console.log('PASS ' + mode + ': basic prompt/reply history readable' + (mode === 'runtime-absent' ? '; native activity and binding readable without executable' : ''))
  } else {
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
  }
} finally { ws.close() }
