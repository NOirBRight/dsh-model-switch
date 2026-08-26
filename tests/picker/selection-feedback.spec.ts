import { describe, expect, it } from 'vitest'
import { beginSelection } from '../../src/picker/selection-feedback.ts'

describe('beginSelection', () => {
  it('shows navigation feedback before waiting for the Host round trip', async () => {
    let resolve!: (accepted: boolean) => void
    const response = new Promise<boolean>((done) => { resolve = done })
    const events: string[] = []

    const pending = beginSelection(
      () => { events.push('request'); return response },
      () => { events.push('feedback') },
      accepted => { events.push(accepted ? 'accepted' : 'rejected') },
    )

    expect(events).toEqual(['feedback', 'request'])
    resolve(true)
    await pending
    expect(events).toEqual(['feedback', 'request', 'accepted'])
  })
})
