import ini from 'ini'
import jsonc from 'jsonc-parser'
import * as vscode from 'vscode'

/* eslint @typescript-eslint/consistent-indexed-object-style: 0 -- recursive */
export type IniObject = { [key: string]: IniValue }
export type IniValue = JsonValue // ini supports (single-quoted) JSON values.
export type JsonObject = { [key: string]: JsonValue }
export type JsonValue =
    null |
    boolean |
    number |
    string |
    JsonValue[] |
    JsonObject

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

export function isJsonObject(
    value: JsonValue | undefined
): value is JsonObject {
    return value instanceof Object && !(value instanceof Array)
}
