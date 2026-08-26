import { readFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'node:path'
import { transform } from 'lightningcss'
import type { UserConfig } from 'tsdown'

const PACKAGE_ID = 'dsh-model-switch'
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Bundle CSS modules into the client plugin so Loader needs only client.js. */
const cssModules = {
  name: 'dsh-css-modules-inline',
  resolveId(source: string, importer: string | undefined) {
    if (!source.endsWith('.module.css')) return null
    const abs = importer === undefined ? resolve(source) : resolve(dirname(importer), source)
    return CSS_VIRTUAL_PREFIX + relative(process.cwd(), abs).replaceAll('\\', '/') + CSS_VIRTUAL_SUFFIX
  },
  async load(virtualId: string) {
    if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
    const relativeId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
    const fileId = resolve(relativeId)
    const source = await readFile(fileId)
    const { code, exports: cssExports } = transform({
      filename: relativeId,
      code: source,
      cssModules: { pattern: '[hash]_[local]' },
      minify: true,
    })
    const classMap: Record<string, string> = {}
    for (const [local, exp] of Object.entries(cssExports ?? {}).sort(([left], [right]) => left.localeCompare(right))) classMap[local] = exp.name
    return [
      `const css = ${JSON.stringify(code.toString())};`,
      `const tagId = ${JSON.stringify(`${PACKAGE_ID}/${basename(fileId)}`)};`,
      "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
      "  const tag = document.createElement('style');",
      `  tag.dataset.plugin = ${JSON.stringify(PACKAGE_ID)};`,
      '  tag.dataset.pluginCss = tagId;',
      '  tag.textContent = css;',
      '  document.head.appendChild(tag);',
      '}',
      `export default ${JSON.stringify(classMap)};`,
    ].join('\n')
  },
}

const host: UserConfig = {
  name: PACKAGE_ID, entry: { index: 'lib/types/index.js', capabilities: 'lib/types/capabilities.js', 'main-settings': 'lib/types/main-settings.js', 'subagent-route-policy': 'lib/types/subagent-route-policy.js', 'subagent-runtime': 'lib/types/subagent-runtime.js' }, outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024', fixedExtension: false, dts: false, clean: false,
  deps: { neverBundle: ['@deepseek-ai/cordis','@deepseek-ai/schemastery','@deepseek-ai/dsh-agent','@deepseek-ai/dsh-agent-default-model','@deepseek-ai/dsh-llm','@deepseek-ai/dsh-settings','@deepseek-ai/dsh-subagent'] },
}
const client: UserConfig = {
  name: `${PACKAGE_ID}/client`, entry: { client: 'src/client/index.tsx' }, outDir: 'lib', format: 'cjs', platform: 'browser', target: 'es2024', dts: false, clean: false, plugins: [cssModules],
  deps: { neverBundle: ['react','react/jsx-runtime','react-dom','@deepseek-ai/cordis','@deepseek-ai/dsh-api-remotes/client','@deepseek-ai/dsh-client-locale/client','@deepseek-ai/dsh-client-runtime/client','@deepseek-ai/dsh-client-ui-settings/client','@deepseek-ai/dsh-client-ui-slots'] },
  define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production') },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}
export default ({ env }: Pick<UserConfig, 'env'>): UserConfig[] => {
  const face = env?.DSH_BUILD_FACE
  if (face === 'host') return [host]
  if (face === 'client') return [client]
  if (face !== undefined) throw new Error('unknown DSH build face: ' + String(face))
  return [host, client]
}
