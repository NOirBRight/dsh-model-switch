/**
 * Suffix grammar for composer picker grouping. Provider plugins own the wire
 * peel; this module only reads catalog ids.
 */

/** Trailing Fast row. */
export const FAST_SUFFIX = '-fast'

/** Parsed picker id after stripping Fast and a numeric context tier. */
export interface ParsedPickerId {
  /** Family key after peeling Fast and `-<n>k` / `-<n>m`. */
  base: string
  /** Whether this row is the Fast sibling. */
  fast: boolean
  /** Context suffix without the leading dash, or null for the standard row. */
  contextTier: string | null
  /** Compaction budget implied by the suffix. */
  contextTokens?: number
}

/** One catalog model as the Host directory projects it. */
export interface CatalogModelView {
  id: string
  name: string
  description?: string
  reasoning?: {
    defaultEffort?: string
    efforts: readonly { id: string, name: string, description?: string }[]
  }
}

/** One provider group from the Host directory. */
export interface CatalogGroupView {
  id: string
  name: string
  models: readonly CatalogModelView[]
}

/** One catalog row inside a suffix family. */
export interface FamilyMember {
  model: CatalogModelView
  fast: boolean
  contextTier: string | null
  contextTokens?: number
  thinking: boolean
}

/** Same-base rows across Fast / context / thinking siblings. */
export interface ModelFamily {
  provider: string
  providerName: string
  base: string
  name: string
  members: FamilyMember[]
}

const CONTEXT_SUFFIX = /-(\d+)(k|m)$/iu

/** Peel Fast and `-<n>k` / `-<n>m` in either order. Product names like `-max` stay. */
export function parsePickerId(id: string): ParsedPickerId {
  let rest = id
  let fast = false
  let contextTier: string | null = null
  let contextTokens: number | undefined
  for (;;) {
    if (rest.endsWith(FAST_SUFFIX) && rest.length > FAST_SUFFIX.length) {
      rest = rest.slice(0, -FAST_SUFFIX.length)
      fast = true
      continue
    }
    const match = CONTEXT_SUFFIX.exec(rest)
    if (match !== null && match.index > 0) {
      const n = Number(match[1])
      const unit = match[2]!.toLowerCase()
      rest = rest.slice(0, match.index)
      contextTier = `${n}${unit}`
      contextTokens = unit === 'm' ? n * 1_000_000 : n * 1_000
      continue
    }
    break
  }
  return {
    base: rest,
    fast,
    contextTier,
    ...(contextTokens === undefined ? {} : { contextTokens }),
  }
}

/** Catalog id for a standard-row window that the Host did not publish. UI localizes this. */
export const STANDARD_CONTEXT_LABEL = 'standard'

/** Human label for a context tier: 1M, 272K, or STANDARD_CONTEXT_LABEL when its window is unknown. */
export function contextTierLabel(tier: string | null, tokens?: number): string {
  if (tier === null) {
    return tokens === undefined ? STANDARD_CONTEXT_LABEL : formatWindow(tokens)
  }
  const match = /^(\d+)(k|m)$/iu.exec(tier)
  if (match !== null) return `${match[1]}${match[2]!.toUpperCase()}`
  return tokens === undefined ? tier : formatWindow(tokens)
}

/** Compact token window for trigger / context-cell copy. */
export function formatWindow(tokens: number): string {
  if (tokens >= 1_000_000 && tokens % 1_000_000 === 0) return `${tokens / 1_000_000}M`
  if (tokens >= 1_000 && tokens % 1_000 === 0) return `${tokens / 1_000}K`
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`
  return String(tokens)
}

/** Standard-row window when the Host directory omits contextWindow. */
export function impliedStandardTokens(base: string): number | undefined {
  if (/^gpt-5\.6(?:-|$)/u.test(base)) return 272_000
}

/** Label a selected variant from catalog identity, never from stale session pressure. */
export function contextLabelForMember(family: ModelFamily, member: FamilyMember): string {
  const tokens = member.contextTokens
    ?? (member.contextTier === null ? impliedStandardTokens(family.base) : undefined)
  return contextTierLabel(member.contextTier, tokens)
}

function memberOf(model: CatalogModelView): FamilyMember {
  const parsed = parsePickerId(model.id)
  return {
    model,
    fast: parsed.fast,
    contextTier: parsed.contextTier,
    ...(parsed.contextTokens === undefined ? {} : { contextTokens: parsed.contextTokens }),
    thinking: model.reasoning !== undefined,
  }
}

/** Group directory rows by provider + peeled base. */
export function groupFamilies(groups: readonly CatalogGroupView[]): ModelFamily[] {
  const families: ModelFamily[] = []
  const index = new Map<string, ModelFamily>()
  for (const group of groups) {
    for (const model of group.models) {
      const parsed = parsePickerId(model.id)
      const key = `${group.id}\0${parsed.base}`
      let family = index.get(key)
      if (family === undefined) {
        family = {
          provider: group.id,
          providerName: group.name,
          base: parsed.base,
          name: displayNameOf(model.name, parsed),
          members: [],
        }
        index.set(key, family)
        families.push(family)
      }
      family.members.push(memberOf(model))
      if (!parsed.fast && parsed.contextTier === null) family.name = displayNameOf(model.name, parsed)
    }
  }
  return families
}

/** Locate the family that owns a provider/model pair. */
export function findFamily(
  families: readonly ModelFamily[],
  provider: string,
  modelId: string,
): ModelFamily | undefined {
  return families.find(family =>
    family.provider === provider && family.members.some(member => member.model.id === modelId),
  )
}

/** Locate one family member by catalog id. */
export function findMember(family: ModelFamily, modelId: string): FamilyMember | undefined {
  return family.members.find(member => member.model.id === modelId)
}

export interface VariantPatch {
  fast?: boolean
  contextTier?: string | null
  thinking?: boolean
}

/** Pick a sibling after toggling Fast / context / thinking, keeping the other axes. */
export function pickVariant(
  family: ModelFamily,
  current: FamilyMember,
  patch: VariantPatch,
): FamilyMember {
  const fast = patch.fast ?? current.fast
  const contextTier = patch.contextTier !== undefined ? patch.contextTier : current.contextTier
  const thinking = patch.thinking ?? current.thinking
  const exact = family.members.find(member =>
    member.fast === fast && member.contextTier === contextTier && member.thinking === thinking,
  )
  if (exact !== undefined) return exact
  const sameTier = family.members.find(member => member.fast === fast && member.contextTier === contextTier)
  if (sameTier !== undefined) return sameTier
  return family.members.find(member => member.fast === fast) ?? family.members[0] ?? current
}

/** Fast row appears only when both a Fast and a non-Fast sibling exist. */
export function familyHasFast(family: ModelFamily): boolean {
  return family.members.some(member => member.fast) && family.members.some(member => !member.fast)
}

function displayNameOf(name: string, parsed: ParsedPickerId): string {
  let next = name
  if (parsed.fast) next = next.replace(/\s+Fast$/iu, '')
  if (parsed.contextTier !== null) next = next.replace(/\s+(?:Max|1M)$/iu, '')
  return next.replace(/\s+/gu, ' ').trim() || name
}

/** Provider sections in catalog order, for the model pane. */
export function sectionFamilies(families: readonly ModelFamily[]): Array<{
  provider: string
  providerName: string
  families: ModelFamily[]
}> {
  const sections: Array<{ provider: string, providerName: string, families: ModelFamily[] }> = []
  const index = new Map<string, (typeof sections)[number]>()
  for (const family of families) {
    let section = index.get(family.provider)
    if (section === undefined) {
      section = { provider: family.provider, providerName: family.providerName, families: [] }
      index.set(family.provider, section)
      sections.push(section)
    }
    section.families.push(family)
  }
  return sections
}

/** Unique context tiers in catalog order. */
export function contextTiers(family: ModelFamily, standardTokens?: number): Array<{
  tier: string | null
  label: string
  tokens?: number
}> {
  const seen = new Set<string>()
  const rows: Array<{ tier: string | null, label: string, tokens?: number }> = []
  for (const member of family.members) {
    const tokens = member.contextTier === null
      ? (member.contextTokens ?? standardTokens ?? impliedStandardTokens(family.base))
      : member.contextTokens
    const label = contextTierLabel(member.contextTier, tokens)
    if (seen.has(label)) continue
    seen.add(label)
    rows.push({
      tier: member.contextTier,
      label,
      ...(tokens === undefined ? {} : { tokens }),
    })
  }
  return rows
}

/** Context row appears only when the family has more than one tier. */
export function familyHasContextChoices(family: ModelFamily): boolean {
  return contextTiers(family).length > 1
}

/** Thinking on/off siblings at the current Fast + context axes, or null. */
export function thinkingSiblings(
  family: ModelFamily,
  current: FamilyMember,
): { on: FamilyMember, off: FamilyMember } | null {
  const on = family.members.find(member =>
    member.fast === current.fast && member.contextTier === current.contextTier && member.thinking,
  )
  const off = family.members.find(member =>
    member.fast === current.fast && member.contextTier === current.contextTier && !member.thinking,
  )
  if (on === undefined || off === undefined) return null
  return { on, off }
}

/** Case-insensitive local search over family name, base, and provider. */
export function filterFamilies(families: readonly ModelFamily[], query: string): ModelFamily[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return [...families]
  return families.filter(family =>
    family.name.toLowerCase().includes(needle)
    || family.base.toLowerCase().includes(needle)
    || family.providerName.toLowerCase().includes(needle)
    || family.members.some(member => member.model.id.toLowerCase().includes(needle)),
  )
}

export interface ModelSelectionView {
  provider: string
  model: string
  reasoningEffort?: string
}

/** Build a Host selection from a member, preserving or defaulting effort. */
export function selectionOf(
  family: ModelFamily,
  member: FamilyMember,
  reasoningEffort?: string,
): ModelSelectionView {
  const reasoning = member.model.reasoning
  const effort = reasoningEffort !== undefined && reasoning?.efforts.some(level => level.id === reasoningEffort)
    ? reasoningEffort
    : reasoning?.defaultEffort
  return {
    provider: family.provider,
    model: member.model.id,
    ...(effort === undefined ? {} : { reasoningEffort: effort }),
  }
}
