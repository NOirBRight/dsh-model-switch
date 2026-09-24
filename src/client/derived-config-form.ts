import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'

export interface ConfigViewForm<T> {
  getSnapshot(): ConfigFormSnapshot<T>
  subscribe(listener: () => void): () => void
  set(field: keyof T & string, value: unknown): Promise<void>
  unset(field: keyof T & string): Promise<void>
}

export function deriveConfigForm<Source, View>(
  source: ConfigForm<Source>,
  project: (value: Source) => View,
  fields: { [K in keyof View & string]: keyof Source & string },
): ConfigViewForm<View> {
  let sourceSnapshot: ConfigFormSnapshot<Source> | undefined
  let viewSnapshot: ConfigFormSnapshot<View> | undefined
  const getSnapshot = (): ConfigFormSnapshot<View> => {
    const current = source.getSnapshot()
    if (current === sourceSnapshot && viewSnapshot !== undefined) return viewSnapshot
    sourceSnapshot = current
    const next = { ...current, value: current.value === undefined ? undefined : project(current.value) }
    viewSnapshot = next
    return next
  }
  const write = async (operation: 'set' | 'unset', field: keyof View & string, value?: unknown): Promise<void> => {
    const sourceField = fields[field]
    const accepted = operation === 'set' ? await source.set(sourceField, value) : await source.unset(sourceField)
    if (!accepted) throw new Error('settings-rejected')
  }
  return {
    getSnapshot,
    subscribe: listener => source.subscribe(listener),
    set: (field, value) => write('set', field, value),
    unset: field => write('unset', field),
  }
}
