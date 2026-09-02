export const zh = {
  nav: '模型切换', title: '模型切换', subtitle: '为主会话、子代理和能力工具设置默认模型。修改只影响新请求。',
  conversationRoutes: '对话路由', capabilityRoutes: '能力路由', settingsSynced: '设置已同步', defaultBadge: '默认', cancel: '取消',
  main: '主模型', provider: '提供商', model: '模型', providerDefault: '使用提供商默认值', providerDefaultShort: 'Provider 默认', effort: '推理强度', save: '保存', saving: '保存中…', saved: '已保存',
  subagent: '子代理', subagentMode: '路由策略', subagentFollowMain: '跟随主模型', subagentFixed: '固定模型',
  search: 'Web 搜索', searchHelp: '继续使用官方 web_search；Model Switch 只在官方 Web Provider 层选择 Codex 模型。', image: '图像生成', imageHelp: '统一 generate_image 会调用所选 Codex 或 Grok Adapter；Provider 原有图片工具仍保留。', unavailable: '未接入', loading: '正在加载设置…', readonly: '设置为只读', requestFailed: '保存失败', catalogFailed: '无法加载模型目录。', conflict: '设置已在其他位置更改，请检查最新值后重试。',
  'reason.central-subagent-routing': 'Alpha.4 没有全局子代理启动路由接口。', 'reason.packaged-preset-roots': 'Alpha.4 不支持插件提供额外 preset root。', 'reason.tool-owner-suppression': 'Alpha.4 没有工具所有者或来源抑制接口。',
  'reason.search-provider-adapters': '当前公开版本没有可按模型切换的搜索 Provider Adapter。', 'reason.vision-provider-adapters': '尚无 Provider 注册可独立路由的 Vision Adapter。', 'reason.image-provider-adapters': '当前公开版本没有图像生成 Provider Adapter。',
} as const

export const en: Record<keyof typeof zh, string> = {
  nav: 'Model Switch', title: 'Model Switch', subtitle: 'Set default models for Main, Subagents, and capability tools. Changes affect new requests only.',
  conversationRoutes: 'Conversation routes', capabilityRoutes: 'Capability routes', settingsSynced: 'Settings synced', defaultBadge: 'Default', cancel: 'Cancel',
  main: 'Main model', provider: 'Provider', model: 'Model', providerDefault: 'Provider default', providerDefaultShort: 'Provider default', effort: 'Reasoning effort', save: 'Save', saving: 'Saving…', saved: 'Saved',
  subagent: 'Subagent', subagentMode: 'Routing policy', subagentFollowMain: 'Follow Main', subagentFixed: 'Fixed model',
  search: 'Web search', searchHelp: 'The official web_search tool remains in place; Model Switch selects the Codex model only at the official Web provider seam.', image: 'Image generation', imageHelp: 'The stable generate_image tool calls the selected Codex or Grok Adapter; existing provider image tools remain available.', unavailable: 'Unavailable', loading: 'Loading settings…', readonly: 'Settings are read-only', requestFailed: 'Save failed', catalogFailed: 'Could not load the model catalog.', conflict: 'Settings changed elsewhere. Review the latest values and retry.',
  'reason.central-subagent-routing': 'Alpha.4 exposes no global Subagent start-routing seam.', 'reason.packaged-preset-roots': 'Alpha.4 exposes no plugin-owned preset root.', 'reason.tool-owner-suppression': 'Alpha.4 exposes no tool owner or provenance suppression seam.',
  'reason.search-provider-adapters': 'This release exposes no model-selectable Search provider adapter.', 'reason.vision-provider-adapters': 'No Provider has registered an independently routable Vision Adapter.', 'reason.image-provider-adapters': 'This release exposes no image-generation provider adapter.',
}

export type ModelSwitchLocaleKey = keyof typeof zh
