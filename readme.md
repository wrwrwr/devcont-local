# Dev Containers: Local Add-on

A small add-on for the [Dev Containers] VS Code extension that merges
local/user additions with the project's `devcontainer.json`.

[Dev Containers]: https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers

## Usage

Install the extension alongside Dev Containers (outside of the container).

Add `devcontainer-local.json` to the `.devcontainer` folder:

```shell
.devcontainer/
├── devcontainer.json
└── devcontainer-local.json
```

```ini
# .gitignore
.devcontainer/devcontainer-local
.devcontainer/devcontainer-local.json
```

Or add [devcontLocal.commonConfiguration] in the user or workspace settings:

```json
"devcontLocal.commonConfiguration": {
    "features": {...},
    "mounts": {...},
    ...
}
```

Press `F1`, choose `Merge Configs`, then `Rebuild and Reopen in Container`
and pick the configuration from the `devcontainer-local` folder.

After edits, the merged `devcontainer.json` should update automatically.

[devcontLocal.commonConfiguration]: vscode://settings/devcontLocal.commonConfiguration

## Examples

Use an updated base image:

```json
// devcontainer-local.json
{
    "image": "ubuntu:latest"
}
```

Add a mount to all containers[^1]:

```json
// user settings
"devcontLocal.commonConfiguration": {
    "mounts": [
        "type=bind,source=${localEnv:HOME}/.bash_aliases,target=/home/vscode/.bash_aliases,readonly"
    ]
}
```

Remove an unused feature[^2]:

```json
{
    "features": {
        "remove:ghcr.io/devcontainers/features/docker-in-docker:3": null
    }
}
```

Limit installed packages[^3]:

```json
{
    "features": {
        "ghcr.io/devcontainers/features/python:1": {
            "toolsToInstall": "ruff,uv"
        }
    }
}
```

Replace post start commands[^4]:

```json
{
    "replace:postStartCommand": {
        "another-manager": "npm install"
    }
}
```

Ensure that a feature builds first:

```json
{
    "overrideFeatureInstallOrder": [
        "ghcr.io/wrwrwr/devcont-feats/apt-https"
    ]
}
```

<!-- vale write-good.E-Prime = off -->
<!-- vale write-good.Passive = off -->
<!-- no clear subject -->
[^1]: By default, objects are merged and arrays extended.
[^2]: Note the `remove:` prefix, the value is ignored.
[^3]: Scalar values are overridden.
[^4]: Without the `replace:` prefix, a base object-type value would be merged.
<!-- vale write-good.Passive = on -->
<!-- vale write-good.E-Prime = on -->

## Notes

The extension has some logging – if it doesn't do what it should,
take a look at the `Output → Dev Containers: Local Add-on` tab.

<!-- vale write-good.TooWordy = off -->
<!-- just additional -->
**License**: MIT\
**Status**: Experimental (non-transcribed TS, only tested on desktop/Ubuntu)\
**Assisted**: Code review, additional test cases and icon drawing by Copilot
<!-- vale write-good.TooWordy = on -->
