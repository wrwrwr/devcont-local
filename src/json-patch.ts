import {
    type JsonObject,
    type JsonValue,
    isJsonObject
} from './ws-configs.ts'

export const REPLACE_PREFIX = 'replace:'
export const REMOVE_PREFIX = 'remove:'

export type AddPrefix<T extends object, P extends string> = {
    [K in Extract<keyof T, string> as `${P}${K}`]: T[K]
}

export type Overrides<T extends object> = Partial<
    T &
    AddPrefix<T, typeof REPLACE_PREFIX> &
    AddPrefix<T, typeof REMOVE_PREFIX>
>

/**
 * Deeply patches a json-like config using overrides with the same structure.
 *
 * @param base configuration to patch
 * @param overrides values to merge, replace or remove
 * @returns base merged with overrides
 */
export function mergeObjects(
    base: JsonObject,
    overrides: Overrides<JsonObject>
): JsonObject {
    const merged = { ...base }
    for (const [key, override] of Object.entries(overrides)) {
        const overrideValue = override as JsonValue // not undefined
        if (key.startsWith(REPLACE_PREFIX)) {
            const baseKey = key.slice(REPLACE_PREFIX.length)
            merged[baseKey] = overrideValue
        } else if (key.startsWith(REMOVE_PREFIX)) {
            const baseKey = key.slice(REMOVE_PREFIX.length)
            /* eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                -- configurable patch on an object of a limited type */
            delete merged[baseKey]
        } else {
            const baseValue = base[key]
            if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
                merged[key] = [...baseValue, ...overrideValue]
            } else if (isJsonObject(baseValue) && isJsonObject(overrideValue)) {
                merged[key] = mergeObjects(baseValue, overrideValue)
            } else {
                merged[key] = overrideValue
            }
        }
    }
    return merged
}
