import type * as vscode from 'vscode'

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

export type Transform<C> = (
    branch: string[],
    value: JsonValue | undefined,
    context: C,
    log: vscode.LogOutputChannel
) => JsonValue | undefined

export type Transforms<C> = { [key: string]: Transforms<C> | Transform<C> }

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

/**
 * Applies functions to config values at chosen keys / subkeys.
 *
 * @param config the configuration to transform
 * @param transforms same structure, functions as leaves
 * @param context common data for transforms
 * @param log for reporting mismatched types
 * @param _branch used for recursion (private)
 * @returns transformed config
 */
export function applyTransforms<C>(
    config: JsonObject,
    transforms: Transforms<C>,
    context: C,
    log: vscode.LogOutputChannel,
    _branch: string[] = []
): JsonObject {
    config = { ...config }
    for (const [key, transform] of Object.entries(transforms)) {
        const value = config[key]
        const keyBranch = [..._branch, key]
        if (typeof transform === 'function') {
            const newValue = transform(keyBranch, value, context, log)
            if (newValue === undefined) {
                /* eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    -- configurable transform on an object of a limited type */
                delete config[key]
            } else {
                config[key] = newValue
            }
        } else if (value === undefined) {
            continue
        } else if (isJsonObject(value)) {
            config[key] = applyTransforms(
                value,
                transform,
                context,
                log,
                keyBranch
            )
        } else {
            log.warn(
                `Expected an object at '${key}' in '${keyBranch.join(".")}'`
            )
        }
    }
    return config
}
