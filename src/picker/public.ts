/** Host-facing re-exports for tests and typed consumers. */

export {
  parsePickerId,
  groupFamilies,
  findFamily,
  pickVariant,
  familyHasFast,
  familyHasContextChoices,
  thinkingSiblings,
  filterFamilies,
  selectionOf,
  contextTierLabel,
  formatWindow,
} from './family.ts'
export type {
  ParsedPickerId, CatalogGroupView, CatalogModelView, FamilyMember, ModelFamily, ModelSelectionView,
} from './family.ts'
export { planReviewOf, selectPlanReview, approvePlanReview } from './plan-review.ts'
export type { PlanReview, PlanReviewOption } from './plan-review.ts'
