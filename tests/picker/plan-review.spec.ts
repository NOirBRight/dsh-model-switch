import { describe, expect, it, vi } from 'vitest'
import { approvePlanReview, planActionView, planReviewOf, selectPlanReview, settlePlanAction } from '../../src/picker/plan-review.ts'

const reviewQuestion = {
  id: 'plan-review',
  question: 'Approve?',
  detail: '# Plan',
  options: [{ label: 'Approve' }, { label: 'Keep planning' }],
  intent: { kind: 'plan-review' as const, approve: 'Approve' },
}

describe('plugin-owned Plan Review', () => {
  it('claims only a binary plan-review question from the composer chain', () => {
    const wait = { kind: 'question', payload: { questions: [reviewQuestion] } }
    expect(selectPlanReview({ interactions: [{ kind: 'approval' }, wait] })).toBe(wait)
    expect(planReviewOf([reviewQuestion])?.plan).toBe('# Plan')
    expect(selectPlanReview({ interactions: [{ kind: 'question', payload: { questions: [{ id: 'q', question: 'Hi?' }] } }] })).toBeNull()
  })

  it.each([
    { name: 'missing payload', wait: { kind: 'question' } },
    { name: 'null payload', wait: { kind: 'question', payload: null } },
    { name: 'missing questions', wait: { kind: 'question', payload: {} } },
    { name: 'non-array questions', wait: { kind: 'question', payload: { questions: 'nope' } } },
  ])('returns null for malformed lightweight composer owner input: $name', ({ wait }) => {
    expect(selectPlanReview({ interactions: [wait] })).toBeNull()
  })

  it.each([
    { name: 'multiple questions', questions: [reviewQuestion, reviewQuestion] },
    { name: 'generic question', questions: [{ ...reviewQuestion, intent: undefined }] },
    { name: 'missing detail', questions: [{ ...reviewQuestion, detail: undefined }] },
    { name: 'multi-select', questions: [{ ...reviewQuestion, multiSelect: true }] },
    { name: 'too many options', questions: [{ ...reviewQuestion, options: [...reviewQuestion.options, { label: 'Other' }] }] },
    { name: 'missing approve option', questions: [{ ...reviewQuestion, intent: { kind: 'plan-review', approve: 'Missing' } }] },
  ])('declines malformed Plan Review input: $name', ({ questions }) => {
    expect(planReviewOf(questions as never)).toBeUndefined()
  })

  it('commits the selected execution model before answering Approve', async () => {
    const select = vi.fn(async () => true)
    const answer = vi.fn(async () => undefined)

    await expect(approvePlanReview({
      select,
      selection: { provider: 'codex', model: 'gpt-5.6-sol' },
      answer,
    })).resolves.toBe(true)

    expect(select.mock.invocationCallOrder[0]).toBeLessThan(answer.mock.invocationCallOrder[0]!)
  })

  it('keeps the pending review unanswered when execution-model commit fails', async () => {
    const answer = vi.fn(async () => undefined)

    await expect(approvePlanReview({
      select: async () => false,
      selection: { provider: 'codex', model: 'gpt-5.6-sol' },
      answer,
    })).resolves.toBe(false)
    expect(answer).not.toHaveBeenCalled()
  })

  it('shows a commit error and re-enables retry after rejection', async () => {
    const states: Array<{ busy: boolean; blocked: boolean; error: string | null }> = []

    await expect(settlePlanAction(
      async () => { throw new Error('select failed') },
      state => { states.push(state) },
    )).resolves.toBe(false)

    expect(states).toEqual([
      { busy: true, blocked: false, error: null },
      { busy: false, blocked: false, error: 'select failed' },
    ])
    expect(planActionView(states.at(-1)!, true, true)).toEqual({
      approveDisabled: false,
      error: 'select failed',
    })
  })
})
