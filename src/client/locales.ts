export const zh = {
  nav: '模型切换', title: '模型切换', subtitle: '为主会话、子代理和能力工具设置默认模型。修改只影响新请求。',
  conversationRoutes: '对话路由', capabilityRoutes: '能力路由', settingsSynced: '设置已同步', defaultBadge: '默认', cancel: '取消',
  main: '主模型', provider: '提供商', model: '模型', providerDefault: '使用提供商默认值', providerDefaultShort: 'Provider 默认', effort: '推理强度', save: '保存', saving: '保存中…', saved: '已保存',
  subagent: '子代理', subagentMode: '路由策略', subagentFollowMain: '跟随主模型', subagentFixed: '固定模型',
  search: 'Web 搜索', vision: '视觉理解', visionHelp: 'read_image 会把本地路径或公网图片交给所选 LLM 独立分析，并只把文本描述返回当前会话。任何已注册、声明接受图片输入的模型都可以选用；主模型可以没有视觉能力；普通聊天附件不会被预处理。不接受图片的模型会在调用时明确失败。', image: '图像生成', unavailable: '未接入', loading: '正在加载设置…', readonly: '设置为只读', requestFailed: '保存失败', catalogFailed: '无法加载模型目录。', conflict: '设置已在其他位置更改，请检查最新值后重试。',
  'reason.central-subagent-routing': 'rc.2 没有全局子代理启动路由接口。', 'reason.packaged-preset-roots': 'rc.2 不支持插件提供额外 preset root。', 'reason.tool-owner-suppression': 'rc.2 没有工具所有者或来源抑制接口。',
  'reason.search-provider-adapters': '当前公开版本没有可按模型切换的搜索 Provider Adapter。', 'reason.vision-provider-adapters': '尚无 Provider 注册可独立路由的 Vision Adapter。', 'reason.image-provider-adapters': '当前公开版本没有图像生成 Provider Adapter。',
} as const

export const en: Record<keyof typeof zh, string> = {
  nav: 'Model Switch', title: 'Model Switch', subtitle: 'Set default models for Main, Subagents, and capability tools. Changes affect new requests only.',
  conversationRoutes: 'Conversation routes', capabilityRoutes: 'Capability routes', settingsSynced: 'Settings synced', defaultBadge: 'Default', cancel: 'Cancel',
  main: 'Main model', provider: 'Provider', model: 'Model', providerDefault: 'Provider default', providerDefaultShort: 'Provider default', effort: 'Reasoning effort', save: 'Save', saving: 'Saving…', saved: 'Saved',
  subagent: 'Subagent', subagentMode: 'Routing policy', subagentFollowMain: 'Follow Main', subagentFixed: 'Fixed model',
  search: 'Web search', vision: 'Vision', visionHelp: 'read_image sends a local path or public URL to the selected LLM for independent analysis and returns only the text description. Any registered model that declares image input can be chosen. Main can be text-only; ordinary chat attachments are not preprocessed. A selected model that does not accept image input fails the call instead of falling back.', image: 'Image generation', unavailable: 'Unavailable', loading: 'Loading settings…', readonly: 'Settings are read-only', requestFailed: 'Save failed', catalogFailed: 'Could not load the model catalog.', conflict: 'Settings changed elsewhere. Review the latest values and retry.',
  'reason.central-subagent-routing': 'rc.2 exposes no global Subagent start-routing seam.', 'reason.packaged-preset-roots': 'rc.2 exposes no plugin-owned preset root.', 'reason.tool-owner-suppression': 'rc.2 exposes no tool owner or provenance suppression seam.',
  'reason.search-provider-adapters': 'This release exposes no model-selectable Search provider adapter.', 'reason.vision-provider-adapters': 'No Provider has registered an independently routable Vision Adapter.', 'reason.image-provider-adapters': 'This release exposes no image-generation provider adapter.',
}

export type ModelSwitchLocaleKey = keyof typeof zh
