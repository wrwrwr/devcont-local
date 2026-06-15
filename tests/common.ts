import assert from 'node:assert'

import * as vscode from 'vscode'

export type Tuple<T, L extends number, A extends readonly T[] = []> =
    A['length'] extends L ? A : Tuple<T, L, readonly [T, ...A]>

type SameIndices<T, V> = { [I in keyof T]: V }

export function getWorkspaceFolders<T extends string[]>(
    ...names: T
): SameIndices<T, vscode.WorkspaceFolder> {
    let folders = vscode.workspace.workspaceFolders
    assert(folders !== undefined)
    folders = folders.filter(folder => names.includes(folder.name))
    assert(folders.length === names.length)
    return folders as SameIndices<T, vscode.WorkspaceFolder>
}

export function createTestLog(): vscode.LogOutputChannel {
    return vscode.window.createOutputChannel(
        'devcont-local-tests',
        { log: true }
    )
}
