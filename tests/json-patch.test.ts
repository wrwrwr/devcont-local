import assert from 'assert'

import { mergeObjects } from '../src/json-patch.ts'
import type { JsonObject } from '../src/ws-configs.ts'
import type { Tuple } from './common.ts'

suite("json-patch", () => {
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
                { p: 1, q: 2 },
            ],
            [
                { p: 1, q: 2 },
                { 'remove:p': 3 },
                { q: 2 },
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
                { o: { a: [7], b: { a: [3, 4] } }, a: [5, 6] },
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
})
