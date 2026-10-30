import assert from 'assert'
import path from 'path'

import type * as vscode from 'vscode'

import {
    fixBuildContextPath,
    fixComposeFilePath,
    fixDockerFilePath,
    getPathPrefix
} from '../src/rel-paths.ts'
import type { JsonValue } from '../src/ws-configs.ts'
import { type Tuple, createTestLog } from './common.ts'

suite("rel-paths", () => {
    let log: vscode.LogOutputChannel

    setup(() => {
        log = createTestLog()
    })

    suite("getPathPrefix", () => {
        const cases: Tuple<string, 3>[] = [
            [
                '.devcontainer/devcontainer-local/devcontainer.json',
                '.devcontainer.json',
                path.join('..', '..')
            ],
            [
                '.devcontainer/devcontainer-local/devcontainer.json',
                '.devcontainer-local.json',
                path.join('..', '..')
            ],
            [
                '.devcontainer/devcontainer-local/devcontainer.json',
                '.devcontainer/devcontainer.json',
                '..'
            ],
            [
                '.devcontainer/devcontainer-local/devcontainer.json',
                '.devcontainer/devcontainer-local.json',
                '..'
            ],
        ]
        for (const [outputPath, configPath, expected] of cases) {
            test(configPath, () => {
                assert.strictEqual(
                    getPathPrefix(outputPath, configPath),
                    expected
                )
            })
        }
    })

    suite("fixBuildContextPath", () => {
        const cases: Tuple<JsonValue | undefined, 2>[] = [
            [undefined, '..'],
            ['.', '..'],
            ['..', path.join('..', '..')],
            process.platform === 'win32'
                ? ['C:\\docker', 'C:\\docker']
                : ['/docker', '/docker'],
            [1, 1],
        ]
        for (const [value, expected] of cases) {
            test(value === undefined ? 'undefined' : JSON.stringify(value), () => {
                assert.strictEqual(
                    fixBuildContextPath(
                        ['build', 'context'],
                        value,
                        { pathPrefix: '..' },
                        log
                    ),
                    expected
                )
            })
        }
    })

    suite("fixDockerFilePath", () => {
        const cases: Tuple<JsonValue | undefined, 2>[] = [
            [undefined, undefined],
            ['Dockerfile', path.join('..', 'Dockerfile')],
            ['./ws.dockerfile', path.join('..', 'ws.dockerfile')],
            [
                './subfolder/Dockerfile',
                path.join('..', 'subfolder', 'Dockerfile')
            ],
            process.platform === 'win32'
                ? ['C:\\Dockerfile', 'C:\\Dockerfile']
                : ['/Dockerfile', '/Dockerfile'],
            [1, 1],
        ]
        for (const [value, expected] of cases) {
            test(value === undefined ? 'undefined' : JSON.stringify(value), () => {
                assert.strictEqual(
                    fixDockerFilePath(
                        ['build', 'dockerfile'],
                        value,
                        { pathPrefix: '..' },
                        log
                    ),
                    expected
                )
            })
        }
    })

    suite("fixComposeFilePath", () => {
        const cases: Tuple<JsonValue | undefined, 2>[] = [
            [undefined, undefined],
            ['compose.yaml', path.join('..', 'compose.yaml')],
            ['./compose.yaml', path.join('..', 'compose.yaml')],
            [
                'subfolder/compose.yaml',
                path.join('..', 'subfolder', 'compose.yaml')
            ],
            process.platform === 'win32'
                ? ['C:\\dir\\compose.yaml', 'C:\\dir\\compose.yaml']
                : ['/dir/compose.yaml', '/dir/compose.yaml'],
            [[], []],
            [
                ['compose1.yaml', 'compose2.yaml'],
                [
                    path.join('..', 'compose1.yaml'),
                    path.join('..', 'compose2.yaml')
                ]
            ],
            [1, 1],
        ]
        for (const [value, expected] of cases) {
            test(value === undefined ? 'undefined' : JSON.stringify(value), () => {
                assert.deepStrictEqual(
                    fixComposeFilePath(
                        ['dockerComposeFile'],
                        value,
                        { pathPrefix: '..' },
                        log
                    ),
                    expected
                )
            })
        }
    })
})
