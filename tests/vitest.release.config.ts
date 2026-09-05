import { createRequire } from 'node:module'
import { defineConfig } from 'vitest/config'

// Resolve public package entrypoints from the release under test, not this plugin's dev install.
const anchor = process.env['DSH_RELEASE_ANCHOR']
if (anchor === undefined) throw new Error('Set DSH_RELEASE_ANCHOR to the official installation package.json')
const require = createRequire(anchor)
const packages = ['@deepseek-ai/cordis', '@deepseek-ai/dsh-web', '@deepseek-ai/dsh-web-search-deepseek', '@deepseek-ai/dsh-credentials', '@deepseek-ai/dsh-launch-environment', '@deepseek-ai/dsh-settings', '@deepseek-ai/dsh-agent-default-model', '@deepseek-ai/dsh-llm', '@deepseek-ai/cordis-plugin-include']
export default defineConfig({
  resolve: { alias: packages.map(name => ({ find: name, replacement: require.resolve(name) })) },
  test: { include: ['tests/{adapter-registry,capabilities-rpc,search-routing.integration,host-runtime.integration,deepseek-search-adapter,search-patch}.spec.ts'] },
})
