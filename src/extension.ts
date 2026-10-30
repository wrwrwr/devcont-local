import * as vscode from 'vscode'

import Package from '../package.json' with {type: 'json'}
import {
    type Transforms,
    applyTransforms,
    mergeObjects
} from './json-patch.ts'
import {
    fixBuildContextPath,
    fixComposeFilePath,
    fixDockerFilePath,
    getPathPrefix
} from './rel-paths.ts'
import {
    type JsonObject,
    type JsonValue,
    isJsonObject,
    readWorkspaceJsonc
} from './ws-configs.ts'

/**
 * Standard Dev Containers configuration files.
 */
const BASE_PATHS = [
    '.devcontainer/devcontainer.json',
    '.devcontainer.json'
]

/**
 * Files merged with the base config.
 */
const LOCAL_PATHS = [
    '.devcontainer/devcontainer-local.json',
    '.devcontainer-local.json'
]

/**
 * Where to write the merged config; needs to be a subfolder of .devcontainer.
 */
const OUTPUT_PATH = '.devcontainer/devcontainer-local/devcontainer.json'

/**
 * A comment to write at the beginning of the merged devcontainer.json.
 */
const OUTPUT_COMMENT = " \
// Local Add-on updates this file automatically, edit the files in\n \
// the parent directory or the commonConfiguration setting instead.\n"

/**
 * Properties with path values relative to devcontainer.json;
 * see: https://containers.dev/implementors/json_reference.
 */
const PATH_TRANSFORMS: Transforms<{ pathPrefix: string }> = {
    build: {
        context: fixBuildContextPath,
        dockerfile: fixDockerFilePath
    },
    dockerComposeFile: fixComposeFilePath
}

/**
 * Used for fixing paths when there is neither base devcontainer.json nor
 * devcontainer-local.json (context files referenced from the user config).
 */
const DEFAULT_BASE_PATH = '.devcontainer/devcontainer.json'

/**
 * Creates a log, registers the merge command and adds refresh listeners.
 *
 * @param context used to register the entities
 */
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

/**
 * Checks if the document's URI ends in one of the base/local config paths.
 *
 * @param doc uri/path to check
 * @returns true if the path matches
 */
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

/**
 * Merges configs in each of the workspace folders.
 *
 * @param folders to merge files in
 * @param isOnChange skip folders excluded from auto-refresh
 * @param log warning if no folders, trace if skipped
 */
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
            const mergeOnChanges = vscode.workspace.getConfiguration(
                'devcontLocal',
                folder
            ).get('mergeOnChanges')
            if (mergeOnChanges === true) {
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

/**
 * Merges a base config with the user config and a local config;
 * applies path fixes.
 *
 * @param folder to merge configs in
 * @param log warning if nothing to merge, traces for values
 */
async function mergeFolderConfigs(
    folder: vscode.WorkspaceFolder,
    log: vscode.LogOutputChannel
): Promise<void> {
    log.info(`Merging configurations in ${folder.uri.fsPath}...`)
    const extConfig = vscode.workspace.getConfiguration('devcontLocal', folder)
    const userConfig = getUserConfig(extConfig, log)
    const localConfig = await readFileConfig(folder, LOCAL_PATHS, log)
    if (userConfig === null && localConfig === null) {
        log.warn("Neither user nor local config, skipping.")
        return
    }
    let mergedConfig: JsonObject = {}
    const baseConfig = await readFileConfig(folder, BASE_PATHS, log)
    if (baseConfig !== null) {
        log.trace("Base config", baseConfig)
        mergedConfig = baseConfig.content
    }
    if (userConfig !== null) {
        log.trace("User config", userConfig)
        mergedConfig = mergeObjects(mergedConfig, userConfig)
    }
    if (localConfig !== null) {
        log.trace("Local config", localConfig)
        mergedConfig = mergeObjects(mergedConfig, localConfig.content)
    }
    if (extConfig.get('fixRelativePaths') === true) {
        const pathPrefix = getPathPrefix(
            OUTPUT_PATH,
            baseConfig?.path ?? localConfig?.path ?? DEFAULT_BASE_PATH
        )
        mergedConfig = applyTransforms(
            mergedConfig,
            PATH_TRANSFORMS,
            { pathPrefix },
            log
        )
    }
    await writeFileConfig(folder, OUTPUT_PATH, mergedConfig, log)
}

/**
 * Returns the commonConfiguration setting as a plain object.
 *
 * @param extConfig scoped to a folder
 * @param log warning if not an object
 * @returns setting value, null if undefined or non-object
 */
function getUserConfig(
    extConfig: vscode.WorkspaceConfiguration,
    log: vscode.LogOutputChannel
): JsonObject | null {
    const userConfigView = extConfig.get('commonConfiguration')
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

/**
 * Returns the first parsable config.
 *
 * @param folder containing the config
 * @param paths potential config locations
 * @param log for reporting reading/parsing problems
 * @returns path and parsed config, null if none found or invalid
 */
async function readFileConfig(
    folder: vscode.WorkspaceFolder,
    paths: string[],
    log: vscode.LogOutputChannel
): Promise<{ path: string, content: JsonObject } | null> {
    let content
    for (const path of paths) {
        content = await readWorkspaceJsonc(folder, path, log)
        if (content !== null) {
            return { path, content }
        }
    }
    return null
}

/**
 * Adds the output comment and saves the config as a file.
 *
 * @param folder to write in
 * @param path relative to the folder
 * @param config to serialize and write
 * @param log info when written, trace with the output path
 */
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
