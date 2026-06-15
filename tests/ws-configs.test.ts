import assert from 'assert'
import type * as vscode from 'vscode'

import {
    type IniObject,
    type JsonObject,
    type JsonValue,
    isJsonObject,
    readWorkspaceFile,
    readWorkspaceIni,
    readWorkspaceJsonc
} from '../src/ws-configs.ts'
import { createTestLog, getWorkspaceFolders } from './common.ts'

suite("ws-configs", () => {
    let folder: vscode.WorkspaceFolder
    let log: vscode.LogOutputChannel

    setup(() => {
        [folder] = getWorkspaceFolders('ws-configs')
        log = createTestLog()
    })

    suite("readWorkspaceFile", () => {
        const cases: [string, string | null][] = [
            ['empty-file.txt', ''],
            ['non-empty-file.txt', 'content\n'],
            ['subdir/file.txt', 'content\n'],
            ['no-such-file.txt', null],
            ['binary-file.dat', null],
        ]
        for (const [path, expected] of cases) {
            test(path, async () => {
                assert.strictEqual(
                    await readWorkspaceFile(folder, path, log),
                    expected
                )
            })
        }
    })

    suite("readWorkspaceIni", () => {
        const nullProto = <T extends Record<string, unknown>>(
            obj: T
        ): T => Object.assign(Object.create(null), obj) as T
        const cases: [string, IniObject | null][] = [
            ['config.ini', nullProto({
                section: nullProto({ bool: true, string: 's' }),
                'section "name"': nullProto({ url: 'https://a.test/path' })
            })],
            ['empty-file.txt', nullProto({})],
            ['no-such-file.ini', null],
            ['binary-file.dat', null],
        ]
        for (const [path, expected] of cases) {
            test(path, async () => {
                assert.deepStrictEqual(
                    await readWorkspaceIni(folder, path, log),
                    expected
                )
            })
        }
    })

    suite("readWorkspaceJsonc", () => {
        const cases: [string, JsonObject | null][] = [
            ['config.json', {
                bool: true,
                int: 1,
                array: [2, 3],
                object: { prop: 4 }
            }],
            ['empty-file.txt', null],
            ['no-such-file.json', null],
            ['binary-file.dat', null],
        ]
        for (const [path, expected] of cases) {
            test(path, async () => {
                assert.deepStrictEqual(
                    await readWorkspaceJsonc(folder, path, log),
                    expected
                )
            })
        }
    })

    suite("isJsonObject", () => {
        const cases: [JsonValue, boolean][] = [
            [null, false],
            [true, false],
            [1, false],
            ['object', false],
            [[1, 2], false],
            [[{ o: {} }], false],
            [{}, true],
            [{ p: 1 }, true],
            [{ p: [2] }, true],
            [{ p: { q: {} } }, true],
        ]
        for (const [value, expected] of cases) {
            test(JSON.stringify(value), () => {
                assert.strictEqual(
                    isJsonObject(value),
                    expected
                )
            })
        }
    })
})
