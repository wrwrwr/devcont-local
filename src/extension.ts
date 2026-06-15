import * as vscode from 'vscode'

import Package from '../package.json' with {type: 'json'}
import { mergeObjects } from './json-patch.ts'
import {
    type JsonObject,
    type JsonValue,
    isJsonObject,
    readWorkspaceJsonc
} from './ws-configs.ts'

const BASE_PATHS = [
    '.devcontainer/devcontainer.json',
    '.devcontainer.json'
]
const LOCAL_PATHS = [
    '.devcontainer/devcontainer-local.json',
    '.devcontainer-local.json'
]
const OUTPUT_PATH = '.devcontainer/devcontainer-local/devcontainer.json'
const OUTPUT_COMMENT = " \
// Local Add-on updates this file automatically, edit the files in\n \
// the parent directory or the commonConfiguration setting instead.\n"

export function activate(
    context: vscode.ExtensionContext
): void {
    const log = vscode.window.createOutputChannel(
        Package.displayName,
        { log: true }
    )
    log.trace(
        // @vale-ignore -- "..." to match other log messages
        "Activating extension..."
    )

    const command = vscode.commands.registerCommand(
        'devcontLocal.mergeConfigs',
        async () => {
            const folders = vscode.workspace.workspaceFolders
            await mergeFoldersConfigs(folders, false, log)
        }
    )

    const configListener = vscode.workspace.onDidChangeConfiguration(
        async event => {
            if (event.affectsConfiguration('devcontLocal')) {
                const folders = vscode.workspace.workspaceFolders
                await mergeFoldersConfigs(folders, true, log)
            }
        }
    )

    const fileListener = vscode.workspace.onDidSaveTextDocument(
        async doc => {
            if (isDevContainerConfig(doc)) {
                const folder = vscode.workspace.getWorkspaceFolder(doc.uri)
                const folders = folder !== undefined ? [folder] : []
                await mergeFoldersConfigs(folders, true, log)
            }
        }
    )

    context.subscriptions.push(log, command, configListener, fileListener)
}

function isDevContainerConfig(
    doc: vscode.TextDocument
): boolean {
    for (const path of [...BASE_PATHS, ...LOCAL_PATHS]) {
        if (doc.uri.path.endsWith('/' + path)) {
            return true
        }
    }
    return false
}

async function mergeFoldersConfigs(
    folders: readonly vscode.WorkspaceFolder[] | undefined,
    isOnChange: boolean,
    log: vscode.LogOutputChannel
): Promise<void> {
    if (folders === undefined || folders.length === 0) {
        log.warn("No open workspace folders, nothing merged.")
        return
    }
    if (isOnChange) {
        folders = folders.filter(folder => {
            if (shouldMergeOnChanges(folder)) {
                return true
            } else {
                log.trace(`Skipping ${folder.uri.fsPath}: updates disabled`)
                return false
            }
        })
    }
    await Promise.allSettled(
        folders.map(folder => mergeFolderConfigs(folder, log))
    )
}

function shouldMergeOnChanges(
    folder: vscode.WorkspaceFolder
): boolean {
    const config = vscode.workspace.getConfiguration('devcontLocal', folder)
    return config.get('mergeOnChanges') === true
}

async function mergeFolderConfigs(
    folder: vscode.WorkspaceFolder,
    log: vscode.LogOutputChannel
): Promise<void> {
    log.info(`Merging configurations in ${folder.uri.fsPath}...`)
    const userConfig = getUserConfig(folder, log)
    const localConfig = await readFileConfig(folder, LOCAL_PATHS, log)
    if (userConfig === null && localConfig === null) {
        log.warn("Neither user nor local config, skipping.")
        return
    }
    let mergedConfig: JsonObject = {}
    const baseConfig = await readFileConfig(folder, BASE_PATHS, log)
    if (baseConfig !== null) {
        log.trace("Base config", baseConfig)
        mergedConfig = baseConfig
    }
    if (userConfig !== null) {
        log.trace("User config", userConfig)
        mergedConfig = mergeObjects(mergedConfig, userConfig)
    }
    if (localConfig !== null) {
        log.trace("Local config", localConfig)
        mergedConfig = mergeObjects(mergedConfig, localConfig)
    }
    await writeFileConfig(folder, OUTPUT_PATH, mergedConfig, log)
}

function getUserConfig(
    folder: vscode.WorkspaceFolder,
    log: vscode.LogOutputChannel
): JsonObject | null {
    const userConfigView = vscode.workspace.getConfiguration(
        'devcontLocal',
        folder
    ).get('commonConfiguration')
    // WA: VS Code 1.143: Second-level Object.entries() / feature merging.
    const userConfig = JSON.parse(JSON.stringify(userConfigView)) as JsonValue
    if (!isJsonObject(userConfig)) {
        log.warn(
            // @vale-ignore -- "should be" seems to be a suitable phrase
            "'commonConfiguration' should be a JSON object"
        )
        return null
    }
    return userConfig
}

async function readFileConfig(
    folder: vscode.WorkspaceFolder,
    paths: string[],
    log: vscode.LogOutputChannel
): Promise<JsonObject | null> {
    let config
    for (const path of paths) {
        config = await readWorkspaceJsonc(folder, path, log)
        if (config !== null) {
            return config
        }
    }
    return null
}

async function writeFileConfig(
    folder: vscode.WorkspaceFolder,
    path: string,
    config: JsonObject,
    log: vscode.LogOutputChannel
): Promise<void> {
    const uri = vscode.Uri.joinPath(folder.uri, path)
    log.trace(`Output file: ${uri.fsPath}`)
    const content = await vscode.workspace.encode(
        OUTPUT_COMMENT + JSON.stringify(config, undefined, 2),
        { uri }
    )
    await vscode.workspace.fs.writeFile(uri, content)
    log.info(`Written: ${uri.fsPath}`)
}
