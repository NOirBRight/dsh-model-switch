/**
 * Composer model seat: suffix-grouped Model / Effort / Context / Fast / Thinking.
 */

import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { ModelSelection } from '@deepseek-ai/dsh-api-session-controller/types'
import {
  Button, IconCheckOutlineRegular, IconChevronDownOutlineRegular, IconChevronLeftOutlineRegular,
  IconChevronRightOutlineRegular, IconCloseOutlineRegular, IconSearchOutlineRegular, IconWarningOutlineRegular,
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
import { ProviderMark } from 'dsh-llm-providers-ui/provider-ui'
import { runtimeChoiceAllowed, type RuntimeProviderLock } from '../runtime-lock.ts'
import { isAgentRole } from '../antigravity-catalog.ts'
import css from './ComposerPicker.module.css'

export type { PickerDirectoryFace, PickerDirectoryOperations, PickerDirectorySnapshot, PickerDirectoryView } from './PickerDirectory.ts'

interface AcceptedSelection {
  selection: ModelSelection
  projectedBeforeRequest: ModelSelection | null
}

function sameSelection(left: ModelSelection | null, right: ModelSelection | null): boolean {
  return left?.provider === right?.provider
    && left?.model === right?.model
    && left?.reasoningEffort === right?.reasoningEffort
}

interface ComposerPickerBaseProps {
  locked: boolean
  providerLock?: RuntimeProviderLock
  /** Hide/disable Agent-role groups on existing DSH sessions that are not native-bound. */
  agentLocked?: boolean
  available: boolean
  /** Explain a disabled picker when the official Host has no persistent settings channel. */
  unavailableReason?: string
  directory: PickerDirectoryView
  t: (key: PickerKey, params?: Record<string, string>) => string
  embedded?: boolean
  tone?: 'capsule'
  resolveInteractionOperations?: () => PickerInteractionOperations | undefined
  /** Resolve a provider key to its ProviderDirectory role; absent means DSH-owned LLM (whale). */
  roleOf?: (providerKey: string) => string | undefined
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
        icon={<IconChevronLeftOutlineRegular size={14} />}
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
              icon={searching ? <IconCloseOutlineRegular size={16} /> : <IconSearchOutlineRegular size={16} />}
              aria-label={searching ? closeSearchLabel : searchLabel}
              onClick={searching ? onCloseSearch : onStartSearch}
            />
          )
        : <span aria-hidden />}
    </div>
  )
}

function RuntimeIcon({ provider, roleOf }: { provider: string, roleOf?: (providerKey: string) => string | undefined }) {
  // Runtime icon, not provider icon: every DSH-owned LLM family shows the DSH whale;
  // only native/external Agent families show their own provider mark.
  const mark = isAgentRole(roleOf?.(provider))
    ? <ProviderMark providerKey={provider} />
    : <ProviderMark providerKey="deepseek-official" />
  return <span className={css.runtimeMark}>{mark}</span>
}

export function ComposerPicker({
  locked, providerLock = null, agentLocked = false, available, unavailableReason, directory, t, draft, onDraftChange, embedded,
  tone,
  resolveInteractionOperations,
  roleOf,
}: ComposerPickerProps) {
  const { snapshot: state, getDirectorySnapshot, load, select } = directory
  const [pane, setPane] = useState<Pane>('root')
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<{ seq: number, text: string } | null>(null)
  const [acceptedSelection, setAcceptedSelection] = useState<AcceptedSelection>()
  const toastSeq = useRef(0)
  const selectionGeneration = useRef(0)
  const lastActionRef = useRef<'load' | 'select'>('load')
  const lockedRef = useRef(locked)
  lockedRef.current = locked

  const families = useMemo(() => groupFamilies(state.groups), [state.groups])
  const currentSelection = draft ?? acceptedSelection?.selection ?? state.current
  const currentCanBeUsed = draft !== undefined || acceptedSelection !== undefined || state.routable !== false
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
  const sections = useMemo(() => sectionFamilies(visibleFamilies), [visibleFamilies])
  const busy = state.status === 'selecting'
  const choiceAllowed = (provider: string): boolean =>
    runtimeChoiceAllowed(
      providerLock,
      agentLocked,
      provider,
      currentSelection?.provider,
      isAgentRole(roleOf?.(provider)),
    )

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
      return
    }
    selectionGeneration.current += 1
    setAcceptedSelection(undefined)
  }, [available, load])

  useEffect(() => {
    if (acceptedSelection === undefined) return
    if (!sameSelection(state.current, acceptedSelection.projectedBeforeRequest)) {
      setAcceptedSelection(undefined)
    }
  }, [acceptedSelection, state.current])

  useEffect(() => {
    if (!locked) return
    selectionGeneration.current += 1
    setAcceptedSelection(undefined)
  }, [locked])

  useLayoutEffect(() => {
    if (!open) return
    const menu = menuRef.current
    if (menu !== null && !menu.contains(document.activeElement)) menu.focus()
  }, [open, pane, searching])

  if (!available) return null

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
    if (lockedRef.current || !choiceAllowed(next.provider)) return
    if (onDraftChange !== undefined) {
      onDraftChange(next)
      returnToRoot()
      return
    }
    if (currentCanBeUsed && sameSelection(currentSelection, next)) {
      returnToRoot()
      return
    }
    lastActionRef.current = 'select'
    if (select !== undefined) {
      const generation = ++selectionGeneration.current
      const projectedBeforeRequest = state.current
      void beginSelection(() => select(next), returnToRoot, (accepted) => {
        if (generation !== selectionGeneration.current || lockedRef.current) return
        if (accepted) setAcceptedSelection({ selection: next, projectedBeforeRequest })
        settleSelection(accepted)
      })
    }
  }

  const chooseMember = (nextFamily: ModelFamily, next: FamilyMember, effort?: string): void => {
    applySelection(selectionOf(nextFamily, next, effort))
  }

  const chooseEffort = (effort: string | undefined): void => {
    if (family === undefined || member === undefined) return
    applySelection(selectionOf(family, member, effort))
  }

  const modelLabel = family?.name ?? member?.model.name ?? currentSelection?.model ?? t('trigger.fallback')
  const contextBit = contextLabel === undefined || contextLabel === STANDARD_CONTEXT_LABEL
    ? undefined
    : member?.contextTier === null ? undefined : contextLabel
  const triggerBits = [
    modelLabel,
    ...effortLabel === undefined ? [] : [effortLabel],
    ...member?.fast === true ? [t('menu.fast')] : [],
    ...contextBit === undefined ? [] : [contextBit],
    ...thinkingPair !== null && member?.thinking === true ? [t('menu.thinking')] : [],
  ]
  const contextDisplay = (label: string): string => label === STANDARD_CONTEXT_LABEL ? t('context.standard') : label
  const triggerLabel = triggerBits.join(' · ')
  const triggerAria = currentSelection === null
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
      tabIndex={-1}
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
            <span className={css.cellValue}>{family?.name ?? modelLabel}</span>
            <IconChevronRightOutlineRegular size={14} className={css.cellChevron} />
          </button>
          {reasoning !== undefined && (
            <button type="button" role="menuitem" className={css.cell} onClick={() => { setPane('effort') }}>
              <span className={css.cellLabel}>{t('menu.effort')}</span>
              <span className={css.cellValue}>{effortLabel}</span>
              <IconChevronRightOutlineRegular size={14} className={css.cellChevron} />
            </button>
          )}
          {family !== undefined && familyHasContextChoices(family) && (
            <button type="button" role="menuitem" className={css.cell} onClick={() => { setPane('context') }}>
              <span className={css.cellLabel}>{t('menu.context')}</span>
              <span className={css.cellValue}>{contextDisplay(contextLabel ?? '')}</span>
              <IconChevronRightOutlineRegular size={14} className={css.cellChevron} />
            </button>
          )}
          {family !== undefined && familyHasFast(family) && (
            <button type="button" role="menuitem" className={css.cell} onClick={() => { setPane('fast') }}>
              <span className={css.cellLabel}>{t('menu.fast')}</span>
              <span className={css.cellValue}>{member?.fast === true ? t('fast.on') : t('fast.off')}</span>
              <IconChevronRightOutlineRegular size={14} className={css.cellChevron} />
            </button>
          )}
          {thinkingPair !== null && (
            <button type="button" role="menuitem" className={css.cell} onClick={() => { setPane('thinking') }}>
              <span className={css.cellLabel}>{t('menu.thinking')}</span>
              <span className={css.cellValue}>{member?.thinking === true ? t('thinking.on') : t('thinking.off')}</span>
              <IconChevronRightOutlineRegular size={14} className={css.cellChevron} />
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
            {sections.map(section => {
              const headingId = `${id}-${section.provider}`
              return (
                <section role="group" aria-labelledby={headingId} className={css.group} key={section.provider}>
                  <div className={css.groupTitle} id={headingId}><RuntimeIcon provider={section.provider} {...(roleOf === undefined ? {} : { roleOf })} />{section.providerName}</div>
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
                        disabled={locked || busy || !choiceAllowed(item.provider)}
                        onClick={() => {
                          if (representative === undefined) return
                          chooseMember(item, representative)
                        }}
                      >
                        <span className={css.optionCopy}>
                          <span className={css.modelName}>{item.name}</span>
                        </span>
                        <span className={css.check}>{selected ? <IconCheckOutlineRegular size={16} /> : null}</span>
                      </button>
                    )
                  })}
                </section>
              )
            })}
          </div>
          {state.status === 'ready' && visibleFamilies.length === 0 && (
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
              disabled={locked || busy || (family !== undefined && !choiceAllowed(family.provider))}
              onClick={() => { chooseEffort(level.id) }}
            >
              <span className={css.optionCopy}>
                <span className={css.modelName}>{level.name}</span>
              </span>
              <span className={css.check}>{effectiveEffort === level.id ? <IconCheckOutlineRegular size={16} /> : null}</span>
            </button>
          ))
      )}

      {pane === 'context' && family !== undefined && member !== undefined && (
        contextTiers(family).map(row => {
          const next = pickVariant(family, member, { contextTier: row.tier })
          const selected = member.contextTier === row.tier
          const honored = next.contextTier === row.tier && next.fast === member.fast && next.thinking === member.thinking
          const unreachable = !selected && (!honored || next.model.id === member.model.id)
          return (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              className={classNames(css.option, selected && css.selected)}
              key={row.tier ?? 'standard'}
              disabled={locked || busy || !choiceAllowed(family.provider) || unreachable}
              title={unreachable ? t('choice.unavailable') : undefined}
              onClick={() => { if (!unreachable) chooseMember(family, next, effectiveEffort) }}
            >
              <span className={css.optionCopy}>
                <span className={css.modelName}>{contextDisplay(row.label)}</span>
              </span>
              <span className={css.check}>{selected ? <IconCheckOutlineRegular size={16} /> : null}</span>
            </button>
          )
        })
      )}

      {pane === 'fast' && family !== undefined && member !== undefined && (
        [false, true].map(fast => {
          const next = pickVariant(family, member, { fast })
          const selected = member.fast === fast
          const honored = next.fast === fast && next.contextTier === member.contextTier && next.thinking === member.thinking
          const unreachable = !selected && (!honored || next.model.id === member.model.id)
          return (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              className={classNames(css.option, selected && css.selected)}
              key={fast ? 'on' : 'off'}
              disabled={locked || busy || !choiceAllowed(family.provider) || unreachable}
              title={unreachable ? t('choice.unavailable') : undefined}
              onClick={() => { if (!unreachable) chooseMember(family, next, effectiveEffort) }}
            >
              <span className={css.optionCopy}>
                <span className={css.modelName}>{fast ? t('fast.on') : t('fast.off')}</span>
              </span>
              <span className={css.check}>{selected ? <IconCheckOutlineRegular size={16} /> : null}</span>
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
              disabled={locked || busy || !choiceAllowed(family.provider)}
              onClick={() => { chooseMember(family, choice.row, effectiveEffort) }}
            >
              <span className={css.optionCopy}>
                <span className={css.modelName}>{choice.on ? t('thinking.on') : t('thinking.off')}</span>
              </span>
              <span className={css.check}>{selected ? <IconCheckOutlineRegular size={16} /> : null}</span>
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
        aria-label={unavailableReason === undefined ? triggerAria : `${triggerAria}: ${unavailableReason}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        title={unavailableReason ?? triggerLabel}
        disabled={locked}
        onPointerDown={onTriggerPointerDown}
        onClick={onTriggerClick}
      >
        <span className={css.triggerLabel}>{currentSelection !== null ? <RuntimeIcon provider={currentSelection.provider} {...(roleOf === undefined ? {} : { roleOf })} /> : null}{triggerLabel}</span>
        <IconChevronDownOutlineRegular size={14} className={classNames(css.chevron, open && css.chevronOpen)} />
      </button>
      {menu !== null && (tone === 'capsule' ? menu : createPortal(menu, document.body))}
      {toast !== null && (
        <Toast
          key={toast.seq}
          text={toast.text}
          icon={<IconWarningOutlineRegular size={16} />}
          anchor={triggerRef.current?.closest<HTMLElement>('[data-composer-card]') ?? null}
          onDone={() => { setToast(null) }}
        />
      )}
    </div>
  )
}
