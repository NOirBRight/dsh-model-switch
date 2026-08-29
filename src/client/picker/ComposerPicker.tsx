/**
 * Composer model seat: suffix-grouped Model / Effort / Context / Fast / Thinking.
 */

import {
  useEffect, useMemo, useRef, useState,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { ModelSelection } from '@deepseek-ai/dsh-api-remotes/client'
import {
  Button, IconCheckOutline16, IconChevronDownOutline14, IconChevronLeftOutline14,
  IconChevronRightOutline14, IconCloseOutline16, IconSearchOutline16, IconWarningOutline16,
  Input, Toast,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { FamilyMember, ModelFamily } from '../../picker/family.ts'
import {
  contextLabelForMember,
  contextTiers,
  STANDARD_CONTEXT_LABEL,
  familyHasContextChoices,
  familyHasFast,
  filterFamilies,
  findFamily,
  findMember,
  groupFamilies,
  pickVariant,
  sectionFamilies,
  selectionOf,
  thinkingSiblings,
} from '../../picker/family.ts'
import { beginSelection } from '../../picker/selection-feedback.ts'
import type { PickerKey } from './locales.ts'
import type { PickerDirectoryView } from './PickerDirectory.ts'
import type { PickerInteractionOperations } from './popup-dismissal.ts'
import { useComposerPickerSurface } from './useComposerPickerSurface.ts'
import css from './ComposerPicker.module.css'

export type { PickerDirectoryFace, PickerDirectoryOperations, PickerDirectorySnapshot, PickerDirectoryView } from './PickerDirectory.ts'

export type ExternalAgentAdapterId = 'codex' | 'claude-code' | 'cursor' | 'antigravity'
export type ExternalPlanTargetId = `external-agent:${ExternalAgentAdapterId}`
export type PlanTargetId = 'dsh' | ExternalPlanTargetId

export interface ComposerPickerExternalTarget {
  id: ExternalPlanTargetId
  label: string
  description?: string
  disabled?: boolean
}

interface ComposerPickerBaseProps {
  locked: boolean
  available: boolean
  directory: PickerDirectoryView
  t: (key: PickerKey, params?: Record<string, string>) => string
  embedded?: boolean
  tone?: 'capsule'
  externalTargets?: readonly ComposerPickerExternalTarget[]
  externalTargetsLabel?: string
  externalSelection?: ExternalPlanTargetId
  onExternalTargetChange?: (id: ExternalPlanTargetId | undefined) => void
  resolveInteractionOperations?: () => PickerInteractionOperations | undefined
}

export type ComposerPickerProps = ComposerPickerBaseProps & (
  | { draft?: never; onDraftChange?: never }
  | { draft?: ModelSelection; onDraftChange: (selection: ModelSelection) => void }
)

type Pane = 'root' | 'model' | 'effort' | 'context' | 'fast' | 'thinking'

function classNames(...parts: Array<string | false | undefined>): string {
  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(' ')
}

export interface ModelPaneHeaderProps {
  title: string
  backLabel: string
  searchLabel: string
  closeSearchLabel: string
  searchable: boolean
  searching: boolean
  query: string
  onBack: () => void
  onStartSearch: () => void
  onCloseSearch: () => void
  onQueryChange: (query: string) => void
}

export function ModelPaneHeader({
  title, backLabel, searchLabel, closeSearchLabel, searchable, searching, query,
  onBack, onStartSearch, onCloseSearch, onQueryChange,
}: ModelPaneHeaderProps) {
  return (
    <div className={css.paneHeader}>
      <Button
        variant="ghost"
        size="sm"
        className={css.headerButton}
        icon={<IconChevronLeftOutline14 />}
        aria-label={backLabel}
        onClick={onBack}
      />
      {searching
        ? (
            <div className={css.searchSlot}>
              <Input
                className={css.headerSearch ?? ''}
                type="search"
                autoFocus
                value={query}
                placeholder={searchLabel}
                aria-label={searchLabel}
                onChange={event => { onQueryChange(event.currentTarget.value) }}
              />
            </div>
          )
        : <div className={css.paneTitle}>{title}</div>}
      {searchable
        ? (
            <Button
              variant="ghost"
              size="sm"
              className={css.headerButton}
              icon={searching ? <IconCloseOutline16 /> : <IconSearchOutline16 />}
              aria-label={searching ? closeSearchLabel : searchLabel}
              onClick={searching ? onCloseSearch : onStartSearch}
            />
          )
        : <span aria-hidden />}
    </div>
  )
}

export function ComposerPicker({
  locked, available, directory, t, draft, onDraftChange, embedded,
  tone,
  externalTargets = [], externalTargetsLabel, externalSelection, onExternalTargetChange,
  resolveInteractionOperations,
}: ComposerPickerProps) {
  const { snapshot: state, getDirectorySnapshot, load, select } = directory
  const [pane, setPane] = useState<Pane>('root')
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<{ seq: number, text: string } | null>(null)
  const toastSeq = useRef(0)
  const lastActionRef = useRef<'load' | 'select'>('load')
  const lockedRef = useRef(locked)
  lockedRef.current = locked

  const families = useMemo(() => groupFamilies(state.groups), [state.groups])
  const currentSelection = draft ?? state.current
  const currentCanBeUsed = draft !== undefined || state.routable !== false
  const family = currentSelection === null
    ? undefined
    : findFamily(families, currentSelection.provider, currentSelection.model)
  const member = family === undefined || currentSelection === null
    ? undefined
    : findMember(family, currentSelection.model)
  const reasoning = member?.model.reasoning
  const effectiveEffort = currentSelection?.reasoningEffort ?? reasoning?.defaultEffort
  const effortLabel = reasoning === undefined
    ? undefined
    : effectiveEffort === undefined
      ? t('effort.providerDefault')
      : reasoning.efforts.find(level => level.id === effectiveEffort)?.name ?? effectiveEffort
  const contextLabel = family === undefined || member === undefined
    ? undefined
    : contextLabelForMember(family, member)
  const thinkingPair = family !== undefined && member !== undefined ? thinkingSiblings(family, member) : null
  const visibleFamilies = useMemo(() => filterFamilies(families, query), [families, query])
  const visibleExternalTargets = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle.length === 0 ? externalTargets : externalTargets.filter(target =>
      target.label.toLowerCase().includes(needle) || target.description?.toLowerCase().includes(needle),
    )
  }, [externalTargets, query])
  const sections = useMemo(() => sectionFamilies(visibleFamilies), [visibleFamilies])
  const busy = state.status === 'selecting'

  const reload = (): void => {
    if (lockedRef.current) return
    lastActionRef.current = 'load'
    load()
  }

  const {
    id, open, menuStyle, triggerRef, menuRef, close,
    onTriggerPointerDown, onTriggerClick,
  } = useComposerPickerSurface({
    locked,
    embedded: embedded ?? false,
    pane,
    reload,
    onOpen: () => {
      setPane(embedded && tone !== 'capsule' ? 'model' : 'root')
      setSearching(false)
      setQuery('')
    },
    onClose: () => {
      setPane('root')
      setSearching(false)
      setQuery('')
    },
    ...(tone === undefined ? {} : { tone }),
    ...(resolveInteractionOperations === undefined ? {} : { resolveInteractionOperations }),
  })

  useEffect(() => {
    if (available) {
      lastActionRef.current = 'load'
      load()
    }
  }, [available, load])


  if (!available && externalTargets.length === 0) return null

  const returnToRoot = (): void => {
    setPane('root')
    setSearching(false)
    setQuery('')
  }

  const settleSelection = (accepted: boolean): void => {
    if (accepted) return
    const message = getDirectorySnapshot().error
    if (message !== null) {
      toastSeq.current += 1
      setToast({ seq: toastSeq.current, text: t('error.action', { message }) })
    }
  }

  const applySelection = (next: ModelSelection): void => {
    if (lockedRef.current) return
    onExternalTargetChange?.(undefined)
    if (onDraftChange !== undefined) {
      onDraftChange(next)
      returnToRoot()
      return
    }
    if (currentCanBeUsed && state.current?.provider === next.provider && state.current.model === next.model
      && state.current.reasoningEffort === next.reasoningEffort) {
      returnToRoot()
      return
    }
    lastActionRef.current = 'select'
    if (select !== undefined) void beginSelection(() => select(next), returnToRoot, settleSelection)
  }

  const chooseMember = (nextFamily: ModelFamily, next: FamilyMember, effort?: string): void => {
    applySelection(selectionOf(nextFamily, next, effort))
  }

  const chooseEffort = (effort: string | undefined): void => {
    if (family === undefined || member === undefined) return
    applySelection(selectionOf(family, member, effort))
  }

  const selectedExternal = externalTargets.find(target => target.id === externalSelection)
  const modelLabel = family?.name ?? member?.model.name ?? currentSelection?.model ?? t('trigger.fallback')
  const effectiveLabel = selectedExternal?.label ?? modelLabel
  const contextBit = contextLabel === undefined || contextLabel === STANDARD_CONTEXT_LABEL
    ? undefined
    : member?.contextTier === null ? undefined : contextLabel
  const triggerBits = selectedExternal !== undefined
    ? [effectiveLabel]
    : [
      effectiveLabel,
      ...effortLabel === undefined ? [] : [effortLabel],
      ...member?.fast === true ? [t('menu.fast')] : [],
      ...contextBit === undefined ? [] : [contextBit],
      ...thinkingPair !== null && member?.thinking === true ? [t('menu.thinking')] : [],
    ]
  const externalHeading = externalTargetsLabel ?? t('external.section')
  const contextDisplay = (label: string): string => label === STANDARD_CONTEXT_LABEL ? t('context.standard') : label
  const triggerLabel = triggerBits.join(' · ')
  const triggerAria = selectedExternal !== undefined
    ? selectedExternal.label
    : currentSelection === null
    ? t('trigger.selectAria')
    : t('trigger.aria', { model: triggerLabel })

  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (lockedRef.current) return
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      if (pane === 'model' && searching) {
        setSearching(false)
        setQuery('')
      } else if (pane !== 'root') {
        returnToRoot()
      } else {
        close(true)
      }
    }
  }

  const paneTitle: Record<Exclude<Pane, 'root'>, PickerKey> = {
    model: 'menu.model',
    effort: 'menu.effort',
    context: 'menu.context',
    fast: 'menu.fast',
    thinking: 'menu.thinking',
  }

  const paneHeader = pane === 'root' ? null : (
    <ModelPaneHeader
      title={t(paneTitle[pane])}
      backLabel={t('menu.back')}
      searchLabel={t('menu.search')}
      closeSearchLabel={t('menu.closeSearch')}
      searchable={pane === 'model'}
      searching={pane === 'model' && searching}
      query={query}
      onBack={returnToRoot}
      onStartSearch={() => { setSearching(true) }}
      onCloseSearch={() => { setSearching(false); setQuery('') }}
      onQueryChange={setQuery}
    />
  )

  const menu = open ? (
    <div
      ref={menuRef}
      id={`${id}-menu`}
      className={css.menu}
      style={menuStyle}
      role="menu"
      aria-label={t('menu.aria')}
      aria-busy={state.status === 'loading' || busy}
      onPointerDown={event => { event.stopPropagation() }}
    >
      {paneHeader}
      <div className={css.list}>
      {pane === 'root' && (
        <>
          <button type="button" role="menuitem" className={css.cell} onClick={() => { setPane('model'); setSearching(false); setQuery('') }}>
            <span className={css.cellLabel}>{t('menu.model')}</span>
            <span className={css.cellValue}>{selectedExternal?.label ?? family?.name ?? modelLabel}</span>
            <IconChevronRightOutline14 className={css.cellChevron} />
          </button>
          {selectedExternal === undefined && reasoning !== undefined && (
            <button type="button" role="menuitem" className={css.cell} onClick={() => { setPane('effort') }}>
              <span className={css.cellLabel}>{t('menu.effort')}</span>
              <span className={css.cellValue}>{effortLabel}</span>
              <IconChevronRightOutline14 className={css.cellChevron} />
            </button>
          )}
          {selectedExternal === undefined && family !== undefined && familyHasContextChoices(family) && (
            <button type="button" role="menuitem" className={css.cell} onClick={() => { setPane('context') }}>
              <span className={css.cellLabel}>{t('menu.context')}</span>
              <span className={css.cellValue}>{contextDisplay(contextLabel ?? '')}</span>
              <IconChevronRightOutline14 className={css.cellChevron} />
            </button>
          )}
          {selectedExternal === undefined && family !== undefined && familyHasFast(family) && (
            <button type="button" role="menuitem" className={css.cell} onClick={() => { setPane('fast') }}>
              <span className={css.cellLabel}>{t('menu.fast')}</span>
              <span className={css.cellValue}>{member?.fast === true ? t('fast.on') : t('fast.off')}</span>
              <IconChevronRightOutline14 className={css.cellChevron} />
            </button>
          )}
          {selectedExternal === undefined && thinkingPair !== null && (
            <button type="button" role="menuitem" className={css.cell} onClick={() => { setPane('thinking') }}>
              <span className={css.cellLabel}>{t('menu.thinking')}</span>
              <span className={css.cellValue}>{member?.thinking === true ? t('thinking.on') : t('thinking.off')}</span>
              <IconChevronRightOutline14 className={css.cellChevron} />
            </button>
          )}
        </>
      )}

      {pane === 'model' && (
        <>
          {state.status === 'loading' && <div className={css.status}>{t('status.loading')}</div>}
          {state.error !== null && lastActionRef.current === 'load' && (
            <div className={css.error}>
              <span>{t('error.action', { message: state.error })}</span>
              <button type="button" className={css.retry} disabled={locked} onClick={reload}>{t('retry')}</button>
            </div>
          )}
          {state.failures.map(failure => (
            <div className={css.warning} key={failure.id}>
              <span>{t('warning.groupLoad', { name: failure.name, message: failure.message })}</span>
              <button type="button" className={css.retry} disabled={locked} onClick={reload}>{t('retry')}</button>
            </div>
          ))}
          <div className={classNames(css.groups, 'scrollable')}>
            {visibleExternalTargets.length > 0 && (
              <section role="group" aria-label={externalHeading} className={css.group}>
                <div className={css.groupTitle}>{externalHeading}</div>
                {visibleExternalTargets.map(target => {
                  const selected = externalSelection === target.id
                  return (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      className={classNames(css.option, selected && css.selected)}
                      key={`external:${target.id}`}
                      disabled={locked || busy || target.disabled === true}
                      onClick={() => {
                        if (lockedRef.current) return
                        onExternalTargetChange?.(target.id)
                        if (embedded) close()
                        else returnToRoot()
                      }}
                    >
                      <span className={css.optionCopy}>
                        <span className={css.modelName}>{target.label}</span>
                        {target.description !== undefined && <span className={css.description}>{target.description}</span>}
                      </span>
                      <span className={css.check}>{selected ? <IconCheckOutline16 /> : null}</span>
                    </button>
                  )
                })}
              </section>
            )}
            {sections.map(section => {
              const headingId = `${id}-${section.provider}`
              return (
                <section role="group" aria-labelledby={headingId} className={css.group} key={section.provider}>
                  <div className={css.groupTitle} id={headingId}>{section.providerName}</div>
                  {section.families.map(item => {
                    const selected = currentSelection?.provider === item.provider
                      && item.members.some(entry => entry.model.id === currentSelection.model)
                    const representative = member !== undefined
                      && family?.provider === item.provider && family.base === item.base
                      ? member
                      : item.members.find(entry => !entry.fast && entry.contextTier === null) ?? item.members[0]
                    return (
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        className={classNames(css.option, selected && css.selected)}
                        key={`${item.provider}:${item.base}`}
                        disabled={locked || busy}
                        onClick={() => {
                          if (representative === undefined) return
                          chooseMember(item, representative)
                        }}
                      >
                        <span className={css.optionCopy}>
                          <span className={css.modelName}>{item.name}</span>
                        </span>
                        <span className={css.check}>{selected ? <IconCheckOutline16 /> : null}</span>
                      </button>
                    )
                  })}
                </section>
              )
            })}
          </div>
          {state.status === 'ready' && visibleFamilies.length === 0 && visibleExternalTargets.length === 0 && (
            <div className={css.empty}>{t('empty.models')}</div>
          )}
        </>
      )}

      {pane === 'effort' && (
        reasoning === undefined || reasoning.efforts.length === 0
          ? <div className={css.empty}>{t('empty.efforts')}</div>
          : reasoning.efforts.map(level => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={effectiveEffort === level.id}
              className={classNames(css.option, effectiveEffort === level.id && css.selected)}
              key={level.id}
              disabled={locked || busy}
              onClick={() => { chooseEffort(level.id) }}
            >
              <span className={css.optionCopy}>
                <span className={css.modelName}>{level.name}</span>
              </span>
              <span className={css.check}>{effectiveEffort === level.id ? <IconCheckOutline16 /> : null}</span>
            </button>
          ))
      )}

      {pane === 'context' && family !== undefined && member !== undefined && (
        contextTiers(family).map(row => {
          const selected = member.contextTier === row.tier
          return (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              className={classNames(css.option, selected && css.selected)}
              key={row.tier ?? 'standard'}
              disabled={locked || busy}
              onClick={() => { chooseMember(family, pickVariant(family, member, { contextTier: row.tier }), effectiveEffort) }}
            >
              <span className={css.optionCopy}>
                <span className={css.modelName}>{contextDisplay(row.label)}</span>
              </span>
              <span className={css.check}>{selected ? <IconCheckOutline16 /> : null}</span>
            </button>
          )
        })
      )}

      {pane === 'fast' && family !== undefined && member !== undefined && (
        [false, true].map(fast => {
          const selected = member.fast === fast
          return (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              className={classNames(css.option, selected && css.selected)}
              key={fast ? 'on' : 'off'}
              disabled={locked || busy}
              onClick={() => { chooseMember(family, pickVariant(family, member, { fast }), effectiveEffort) }}
            >
              <span className={css.optionCopy}>
                <span className={css.modelName}>{fast ? t('fast.on') : t('fast.off')}</span>
              </span>
              <span className={css.check}>{selected ? <IconCheckOutline16 /> : null}</span>
            </button>
          )
        })
      )}

      {pane === 'thinking' && family !== undefined && member !== undefined && thinkingPair !== null && (
        [{ on: true, row: thinkingPair.on }, { on: false, row: thinkingPair.off }].map(choice => {
          const selected = member.thinking === choice.on
          return (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              className={classNames(css.option, selected && css.selected)}
              key={choice.on ? 'on' : 'off'}
              disabled={locked || busy}
              onClick={() => { chooseMember(family, choice.row, effectiveEffort) }}
            >
              <span className={css.optionCopy}>
                <span className={css.modelName}>{choice.on ? t('thinking.on') : t('thinking.off')}</span>
              </span>
              <span className={css.check}>{selected ? <IconCheckOutline16 /> : null}</span>
            </button>
          )
        })
      )}
      </div>
    </div>
  ) : null

  return (
    <div className={classNames(css.root, tone === 'capsule' ? css.capsule : embedded && css.embedded)} onKeyDown={onRootKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={css.trigger}
        aria-label={triggerAria}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        title={triggerLabel}
        disabled={locked}
        onPointerDown={onTriggerPointerDown}
        onClick={onTriggerClick}
      >
        <span className={css.triggerLabel}>{triggerLabel}</span>
        <IconChevronDownOutline14 className={classNames(css.chevron, open && css.chevronOpen)} />
      </button>
      {menu !== null && (tone === 'capsule' ? menu : createPortal(menu, document.body))}
      {toast !== null && (
        <Toast
          key={toast.seq}
          text={toast.text}
          icon={<IconWarningOutline16 />}
          anchor={triggerRef.current?.closest<HTMLElement>('[data-composer-card]') ?? null}
          onDone={() => { setToast(null) }}
        />
      )}
    </div>
  )
}
