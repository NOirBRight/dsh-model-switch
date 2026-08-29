import { describe, expect, it, vi } from 'vitest'
import { RemoteSettingsScope } from '../src/client/remote-settings-scope.js'

describe('RemoteSettingsScope', () => {
  it('loads and writes one authenticated Host namespace', async () => {
    const view = { ns: 'model-switch', value: { mode: 'follow-main' }, base: {}, user: {}, revision: 3 }
    const describe = vi.fn(async () => ({ ok: true, value: { writable: true, namespaces: [view] } }))
    const mutate = vi.fn(async () => ({ ok: true, value: { ...view, value: { mode: 'fixed' }, revision: 4 } }))
    const scope = new RemoteSettingsScope({ describe, mutate }, 'model-switch', value => value as { mode: string })
    await scope.reload()
    expect(scope.getSnapshot()).toMatchObject({ status: 'ready', value: { mode: 'follow-main' }, revision: 3, writable: true, mode: 'host' })
    await scope.set('mode', 'fixed')
    expect(mutate).toHaveBeenCalledWith('model-switch', [{ op: 'set', path: ['mode'], value: 'fixed' }], 3)
    expect(scope.getSnapshot()).toMatchObject({ value: { mode: 'fixed' }, revision: 4 })
  })
})
