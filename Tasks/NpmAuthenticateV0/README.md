# npm authenticate

By default, `npmAuthenticate@0` adds credentials to `workingFile` and restores
the original file post-job. Existing pipelines retain this behavior.

Both modes share credential replacement and insertion logic. Default mode
retains its legacy host/path substring matching and override warnings; global
mode replaces only authentication settings at the exact normalized registry
scope, preserving other scopes and non-authentication settings.

## Opt in to global authentication

Set `useGlobalConfig: true` to leave `workingFile` unchanged and use a private
temporary global npm config. The task reads registries from `workingFile`,
copies existing global settings, adds credentials, and sets
`NPM_CONFIG_GLOBALCONFIG` for later steps in the same job. Full-line comments
are omitted from the generated config. User configuration and the original
global file are not modified. The temporary file is deleted
post-job; abrupt agent termination can prevent deletion.

On a Windows agent, with registry mappings in the project's `.npmrc`:

```yaml
steps:
- task: npmAuthenticate@0
  inputs:
    workingFile: '$(Build.SourcesDirectory)\.npmrc'
    useGlobalConfig: true

- pwsh: npm ci
  workingDirectory: '$(Build.SourcesDirectory)'
```

`workingFile` remains required and supplies registry discovery, not automatic
package routing. Run npm in the project whose config supplies those mappings.
Existing `customEndpoint` and WIF credential-selection rules still apply.
Feed access permissions are unchanged.

## Before opting in

- Project and user settings outrank global settings. Expired higher-priority
  credentials may break authentication that succeeds in default mode. Correct
  conflicting entries securely or retain default mode.
- Set up Node/npm, prefix, and global settings first. The generated file is a
  snapshot; later changes to the original file are not merged automatically.
  Unsupported relative path settings in that file cause an explicit failure;
  use absolute paths. INI sections are also unsupported.
- Do not pass `--globalconfig` or override `NPM_CONFIG_GLOBALCONFIG` afterward
  when expecting task credentials. `--userconfig` still permits global config,
  but that user file's settings retain higher priority.
- Do not add `--global` to enable this feature. Ordinary npm commands already
  read global config; global installation mode does not read project config.
- Authenticate separately in each job. Other package managers and separately
  launched containers are not guaranteed to inherit or honor this configuration.
- Do not print, cache, or publish the generated file. Keeping secrets outside
  the checkout does not encrypt them or hide them from the agent account.

Repeated global-mode steps accumulate registry credentials; the latest
successful step wins for the same scope. Changing global selection between
those steps causes an explicit failure. Prefer one authentication mode per job;
legacy project credentials take precedence when modes are mixed.
