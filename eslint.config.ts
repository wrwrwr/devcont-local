import { fileURLToPath } from 'node:url'

import { defineConfig, includeIgnoreFile } from 'eslint/config'
import js from '@eslint/js'
import json from 'eslint-plugin-package-json'
import mocha from 'eslint-plugin-mocha'
import ts from 'typescript-eslint'

export default defineConfig([
    includeIgnoreFile(
        fileURLToPath(new URL('.gitignore', import.meta.url)),
        { gitignoreResolution: true }
    ),

    {
        files: ['package.json'],
        extends: [
            json.configs.recommended,
            json.configs.stylistic
        ],
        rules: {
            // WA: eslint-plugin-package-json 1.11: vsce doesn't include
            // lowercase license/readme by default.
            'package-json/no-redundant-files': 'off'
        }
    },

    {
        files: ['**/*.ts', '.vscode-test.mjs'],
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['.vscode-test.mjs']
                }
            }
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'error',
            reportUnusedInlineConfigs: 'error'
        },
        extends: [
            js.configs.recommended,
            ts.configs.strictTypeChecked,
            ts.configs.stylisticTypeChecked
        ],
        rules: {
            camelcase: 'error',
            semi: ['error', 'never'],

            // Import/export and typing consistency.
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
            '@typescript-eslint/consistent-type-exports': 'error',
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/explicit-function-return-type': 'error',
            '@typescript-eslint/explicit-module-boundary-types': 'error',
            '@typescript-eslint/no-import-type-side-effects': 'error',
            '@typescript-eslint/strict-boolean-expressions': 'error'
        }
    },

    {
        files: ['tests/*.test.ts'],
        extends: [
            mocha.configs.all
        ],
        rules: {
            'mocha/consistent-interface': ['error', { interface: 'TDD' }]
        }
    }
])
