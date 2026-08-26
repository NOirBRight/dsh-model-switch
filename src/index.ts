export { Config, MODEL_SWITCH_SETTINGS_NAMESPACE, type Config as ModelSwitchSettings } from './host-settings.js'
export { mainDefaultPort, ModelSwitchRuntime, type MainDefaultPort } from './host-runtime.js'
export { ModelSwitchAdapterRegistry, type ModelSwitchProviderAdapters, type ModelSwitchSearchAdapter, type ModelSwitchImageAdapter, type ModelSwitchImageRequest, type ModelSwitchGeneratedImage } from './adapter-registry.js'
export { RUNTIME_CAPABILITIES, type RuntimeCapabilities, type RuntimeCapability } from './runtime-capabilities.js'
export {
  parsePickerId, groupFamilies, planReviewOf, selectPlanReview, approvePlanReview,
} from './picker/public.ts'

export const name = 'dsh-model-switch'

export { ModelSwitchRuntime as default } from './host-runtime.js'
