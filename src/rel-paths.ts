import path from 'path'

import type * as vscode from 'vscode'

import type { JsonValue } from './ws-configs.ts'

/**
 * Determines the path to use in relative path transformations.
 *
 * @param outputPath of the merged config
 * @param configPath of the original config
 * @returns relative path between directories
 */
export function getPathPrefix(
    outputPath: string,
    configPath: string
): string {
    return path.relative(
        path.dirname(outputPath),
        path.dirname(configPath)
    )
}

/**
 * Prefixes the path if it's relative, defaulting to '.' if not set.
 *
 * @param branch the location of the value
 * @param value the value to transform
 * @param context common transformations data
 * @param context.pathPrefix from the merged to the base config
 * @param log warning if non-string, trace if added or replaced
 * @returns transformed value
 */
export function fixBuildContextPath(
    branch: string[],
    value: JsonValue | undefined,
    context: { pathPrefix: string },
    log: vscode.LogOutputChannel
): JsonValue | undefined {
    if (value === undefined) {
        log.trace(`Adding '${branch.join(".")}' with '${context.pathPrefix}'`)
        return context.pathPrefix
    }
    return prefixRelativePath(branch, value, context.pathPrefix, log)
}

/**
 * Prefixes the path if it's defined and relative.
 *
 * @param branch the location of the value
 * @param value the value to transform
 * @param context common transformations data
 * @param context.pathPrefix from the merged to the base config
 * @param log warning if non-string, trace if replaced
 * @returns transformed value
 */
export function fixDockerFilePath(
    branch: string[],
    value: JsonValue | undefined,
    context: { pathPrefix: string },
    log: vscode.LogOutputChannel
): JsonValue | undefined {
    if (value === undefined) {
        return value
    }
    return prefixRelativePath(branch, value, context.pathPrefix, log)
}

/**
 * Prefixes a single relative path or relative paths in an array.
 *
 * @param branch the location of the value
 * @param value the value to transform
 * @param context common transformations data
 * @param context.pathPrefix from the merged to the base config
 * @param log warning if non-string, trace for each replaced
 * @returns transformed value
 */
export function fixComposeFilePath(
    branch: string[],
    value: JsonValue | undefined,
    context: { pathPrefix: string },
    log: vscode.LogOutputChannel
): JsonValue | undefined {
    if (value === undefined) {
        return value
    }
    if (typeof value === 'string') {
        return prefixRelativePath(branch, value, context.pathPrefix, log)
    }
    if (Array.isArray(value)) {
        return value.map(
            (v, i) => prefixRelativePath(
                [...branch, i.toString()],
                v,
                context.pathPrefix,
                log
            )
        )
    }
    log.warn(`Expected a string or an array at '${branch.join(".")}'`)
    return value
}

/**
 * Adds a prefix if the path is relative.
 *
 * @param branch location to use in log messages
 * @param value expected to be a file path
 * @param prefix prepended to the path with '/'
 * @param log warning if non-string, trace if changed
 * @returns unchanged value if absolute, prepended if relative
 */
function prefixRelativePath(
    branch: string[],
    value: JsonValue,
    prefix: string,
    log: vscode.LogOutputChannel
): JsonValue {
    if (typeof value !== 'string') {
        log.warn(`Expected a string value at '${branch.join(".")}'`)
        return value
    }
    if (path.isAbsolute(value)) {
        return value
    }
    const newValue = path.join(prefix, value)
    log.trace(`Replacing '${branch.join(".")}' with '${newValue}'`)
    return newValue
}
