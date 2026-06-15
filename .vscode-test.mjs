import { defineConfig } from '@vscode/test-cli'

export default defineConfig({
    files: 'tests/*.test.ts',
    workspaceFolder: 'tests/test.code-workspace'
})
