import assert from 'assert'
import * as vscode from 'vscode'

import { readWorkspaceJsonc } from '../src/ws-configs.ts'
import { type Tuple, createTestLog, getWorkspaceFolders } from './common.ts'

const TEST_USER_CONFIG = {
    'features': {
        'abc.test/a-feature-from-user-configuration': {}
    }
}

suite("extension", () => {
    let folders: Tuple<vscode.WorkspaceFolder, 3>
    let log: vscode.LogOutputChannel

    setup(async () => {
        await vscode.workspace.getConfiguration('devcontLocal').update(
            'commonConfiguration',
            TEST_USER_CONFIG,
            vscode.ConfigurationTarget.Global
        )
        folders = getWorkspaceFolders(
            'extension-0',
            'extension-1',
            'extension-2'
        )
        log = createTestLog()
    })

    test("merge command", async () => {
        await deleteAllMerged()
        await vscode.commands.executeCommand('devcontLocal.mergeConfigs')
        await assertMerged(folders[0], log)
        await assertMerged(folders[1], log)
        await assertMerged(folders[2], log)
        await deleteAllMerged()
    })

    test("auto refresh", async () => {
        await deleteAllMerged()
        const didCreate = createCreateWatcher(
            folders[0],
            '.devcontainer/devcontainer-local'
        )
        await triggerSaveEvents(folders[2], '.devcontainer/devcontainer.json')
        await triggerSaveEvents(folders[0], '.devcontainer.json')
        await didCreate
        await new Promise(resolve => setTimeout(resolve, 111)) // Not created.
        await assertMerged(folders[0], log)
        await assertNotMerged(folders[1], log)
        await assertNotMerged(folders[2], log) // Disabled in folder settings.
        await deleteAllMerged()
    })
})

async function assertMerged(
    folder: vscode.WorkspaceFolder,
    log: vscode.LogOutputChannel
): Promise<void> {
    const merged = await readWorkspaceJsonc(
        folder,
        '.devcontainer/devcontainer-local/devcontainer.json',
        log
    )
    const expected = await readWorkspaceJsonc(
        folder,
        'expected.json',
        log
    )
    assert.deepStrictEqual(merged, expected)
}

async function assertNotMerged(
    folder: vscode.WorkspaceFolder,
    log: vscode.LogOutputChannel
): Promise<void> {
    const merged = await readWorkspaceJsonc(
        folder,
        '.devcontainer/devcontainer-local/devcontainer.json',
        log
    )
    assert.strictEqual(merged, null)
}

async function deleteAllMerged(): Promise<void> {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        await vscode.workspace.fs.delete(
            vscode.Uri.joinPath(
                folder.uri,
                '.devcontainer/devcontainer-local'
            ),
            { recursive: true }
        )
    }
}

async function createCreateWatcher(
    folder: vscode.WorkspaceFolder,
    path: string
): Promise<vscode.Uri> {
    const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(folder, path)
    )
    return new Promise(resolve => watcher.onDidCreate(resolve))
}

async function triggerSaveEvents(
    folder: vscode.WorkspaceFolder,
    path: string
): Promise<void> {
    const uri = vscode.Uri.joinPath(folder.uri, path)
    await vscode.commands.executeCommand('vscode.open', uri)
    const editor = vscode.window.activeTextEditor
    if (editor === undefined) {
        throw Error("no editor after opening a document")
    }
    const range = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(0, 1)
    )
    await editor.edit(builder => {
        builder.replace(range, editor.document.getText(range))
    })
    await editor.document.save()
}
