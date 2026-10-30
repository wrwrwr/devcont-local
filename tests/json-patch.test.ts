import assert from 'assert'

import type * as vscode from 'vscode'

import {
    type Transforms,
    applyTransforms,
    mergeObjects
} from '../src/json-patch.ts'
import type { JsonObject, JsonValue } from '../src/ws-configs.ts'
import { type Tuple, createTestLog } from './common.ts'

function testTransform1(
    branch: string[],
    value: JsonValue | undefined,
    context: string,
    log: vscode.LogOutputChannel
): JsonValue | undefined {
    if (value === undefined) {
        return 1
    }
    if (value === 'r') {
        return undefined
    }
    if (typeof value === 'number') {
        return value + 1
    }
    if (typeof value === 'string') {
        return value + context
    }
    if (Array.isArray(value)) {
        return [...value, 1]
    }
    log.warn(`Unexpected value type '${typeof value}' at ${branch.join(".")}`)
    return value
}

function testTransform2(
    branch: string[],
    value: JsonValue | undefined,
    context: string,
    log: vscode.LogOutputChannel
): JsonValue | undefined {
    if (value === undefined) {
        return 2
    }
    if (value === 'rr') {
        return undefined
    }
    if (typeof value === 'number') {
        return value + 2
    }
    if (typeof value === 'string') {
        return value + context + context
    }
    if (Array.isArray(value)) {
        return [null, { q: [2] }, ...value]
    }
    log.warn(`Unexpected value type '${typeof value}' at ${branch.join(".")}`)
    return value
}

suite("json-patch", () => {
    let log: vscode.LogOutputChannel

    setup(() => {
        log = createTestLog()
    })

    suite("mergeObjects", () => {
        const cases: Tuple<JsonObject, 3>[] = [
            [
                { p: 1 },
                { p: 2 },
                { p: 2 }
            ],
            [
                { a: [1, 3] },
                { a: [2, 4] },
                { a: [1, 3, 2, 4] }
            ],
            [
                { o: { a: [1, 3], b: [] } },
                { o: { a: [2, 4], b: [5] } },
                { o: { a: [1, 3, 2, 4], b: [5] } }
            ],
            [
                { o: { p: 1, r: 2 } },
                { o: { p: 3, q: 4 } },
                { o: { p: 3, r: 2, q: 4 } }
            ],
            [
                { o: { m: { p: 1, r: 2 }, n: {} } },
                { o: { m: { p: 3, q: 4 }, n: { p: 5 } } },
                { o: { m: { p: 3, r: 2, q: 4 }, n: { p: 5 } } }
            ],
            [
                { p: 1 },
                { 'remove:p': null },
                {}
            ],
            [
                { p: 1, q: 2, r: 3 },
                { 'remove:q': null },
                { p: 1, r: 3 }
            ],
            [
                { p: 1, q: 2 },
                { 'remove:p': null, 'remove:q': null },
                {}
            ],
            [
                { p: 1, q: 2 },
                { 'remove:r': null },
                { p: 1, q: 2 }
            ],
            [
                { p: 1, q: 2 },
                { 'remove:p': 3 },
                { q: 2 }
            ],
            [
                { o: { a: 1, b: 2, c: 3 } },
                { o: { 'remove:b': null } },
                { o: { a: 1, c: 3 } }
            ],
            [
                { a: 1, b: 2 },
                { 'replace:a': 3 },
                { a: 3, b: 2 }
            ],
            [
                { o: { a: 1, b: 2 } },
                { 'replace:o': { c: 3 } },
                { o: { c: 3 } }
            ],
            [
                { o: { m: { p: 1, q: 2 }, n: 3 } },
                { o: { 'replace:m': { r: 4 } } },
                { o: { m: { r: 4 }, n: 3 } }
            ],
            [
                { a: [1, 2], b: 't' },
                { 'replace:a': [3] },
                { a: [3], b: 't' }
            ],
            [
                { o: { a: [1, 2], b: { a: [3, 4] } }, a: [5, 6] },
                { o: { 'replace:a': [7] } },
                { o: { a: [7], b: { a: [3, 4] } }, a: [5, 6] }
            ],
            [
                { o: { p: 1 } },
                { 'replace:o': [1, 2, 3] },
                { o: [1, 2, 3] }
            ],
        ]
        for (const [obj1, obj2, expected] of cases) {
            test(JSON.stringify(obj1) + ", " + JSON.stringify(obj2), () => {
                assert.deepStrictEqual(
                    mergeObjects(obj1, obj2),
                    expected
                )
            })
        }
    })

    suite("applyTransforms", () => {
        const cases: [JsonObject, Transforms<string>, JsonObject][] = [
            [
                { p: 1 },
                { p: testTransform1 },
                { p: 2 }
            ],
            [
                { p: 'a' },
                { p: testTransform1 },
                { p: 'at' }
            ],
            [
                { p: { q: 'a', r: 'b' }, q: 'c' },
                { p: { q: testTransform1 } },
                { p: { q: 'at', r: 'b' }, q: 'c' }
            ],
            [
                { p: { q: 'a', r: { q: 'a', r: 'b' } }, q: 'c' },
                { p: { q: testTransform1, r: { r: testTransform2 } } },
                { p: { q: 'at', r: { q: 'a', r: 'btt' } }, q: 'c' }
            ],
            [
                { p: { q: [1, 2], r: [3, 4] } },
                { p: { q: testTransform1, r: testTransform2 } },
                { p: { q: [1, 2, 1], r: [null, { q: [2] }, 3, 4] } }
            ],
            [
                { p: 3 },
                { q: testTransform1, r: { q: testTransform2 } },
                { p: 3, q: 1 }
            ],
            [
                { p: 'r' },
                { p: testTransform1 },
                {}
            ],
            [
                { p: { r: 'rr' } },
                { p: { q: testTransform1, r: testTransform2 } },
                { p: { q: 1 } }
            ],
        ]
        for (const [config, transforms, expected] of cases) {
            const configJson = JSON.stringify(config)
            test(configJson, () => {
                assert.deepStrictEqual(
                    applyTransforms(config, transforms, 't', log),
                    expected
                )
                assert.strictEqual(
                    configJson,
                    JSON.stringify(config)
                )
            })
        }
    })
})
