import ini from 'ini'
import jsonc from 'jsonc-parser'
import * as vscode from 'vscode'

export type IniObject = Record<string, IniValue>
export type IniValue = JsonValue // ini supports (single-quoted) JSON values.
export type JsonObject = { [key: string]: JsonValue }
export type JsonValue =
    null |
    boolean |
    number |
    string |
    JsonValue[] |
    JsonObject

/**
 * Reads and decodes a file in a workspace folder.
 *
 * @param folder containing the file
 * @param path relative to the folder
 * @param log warning if undecodable, trace if not found
 * @returns file contents, null if not found or undecodable
 */
export async function readWorkspaceFile(
    folder: vscode.WorkspaceFolder,
    path: string,
    log: vscode.LogOutputChannel
): Promise<string | null> {
    const uri = vscode.Uri.joinPath(folder.uri, path)
    let bytes
    try {
        bytes = await vscode.workspace.fs.readFile(uri)
    } catch (error: unknown) {
        if (
            error instanceof vscode.FileSystemError &&
            error.code === 'FileNotFound'
        ) {
            log.trace(`Not found: ${uri.fsPath}`)
            return null
        }
        throw error
    }
    try {
        return await vscode.workspace.decode(bytes, { uri })
    } catch (error: unknown) {
        if (
            error instanceof Error &&
            Object.hasOwn(error, 'decodeStreamErrorKind')
        ) {
            log.warn(`Cannot decode: ${uri.fsPath}`, error)
            return null
        }
        throw error
    }
}

/**
 * Reads and parses a .ini file.
 *
 * @param folder containing the file
 * @param path relative to the folder
 * @param log warning if undecodable, trace if not found
 * @returns parsed config, null if not found or undecodable
 */
export async function readWorkspaceIni(
    folder: vscode.WorkspaceFolder,
    path: string,
    log: vscode.LogOutputChannel
): Promise<IniObject | null> {
    const content = await readWorkspaceFile(folder, path, log)
    if (content === null) {
        return null
    }
    return ini.parse(content)
}

/**
 * Reads and parses a .json file with comments.
 *
 * @param folder containing the file
 * @param path relative to the folder
 * @param log warning if undecodable, invalid or non-object, trace if not found
 * @returns parsed config, null if not found, unparsable or non-object
 */
export async function readWorkspaceJsonc(
    folder: vscode.WorkspaceFolder,
    path: string,
    log: vscode.LogOutputChannel
): Promise<JsonObject | null> {
    const content = await readWorkspaceFile(folder, path, log)
    if (content === null) {
        return null
    }
    const errors: jsonc.ParseError[] = []
    const parsed = jsonc.parse(content, errors, {
        allowTrailingComma: true
    }) as JsonValue
    if (errors.length !== 0) {
        log.warn(`Invalid syntax: ${path}`, errors)
        return null
    }
    if (!isJsonObject(parsed)) {
        log.warn(`Unexpected type: ${path} (${typeof parsed})`)
        return null
    }
    return parsed
}

/**
 * Checks if a value is a plain object.
 *
 * @param value from a parsed config
 * @returns true if an object and not an array
 */
export function isJsonObject(
    value: JsonValue | undefined
): value is JsonObject {
    return value instanceof Object && !(value instanceof Array)
}
