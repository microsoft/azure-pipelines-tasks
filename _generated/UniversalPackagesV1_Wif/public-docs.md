---
title: UniversalPackages@1 - Universal packages v1 task
description: Download or publish Universal Packages
ms.date: 02/10/2026
monikerRange: ">=azure-pipelines-2022.1"
---

# UniversalPackages@1 - Universal packages v1 task

<!-- :::description::: -->
:::moniker range=">=azure-pipelines-2022.1"

Use this task to download or publish Universal Packages to and from Azure Artifacts feeds. This version supports Workload Identity Federation (WIF) through Azure DevOps service connections, enabling authentication without Personal Access Tokens (PATs).

<!-- :::description-end::: -->

:::moniker-end

<!-- :::syntax::: -->

## Syntax

```yaml
# Universal packages v1
# Download or publish Universal Packages.
- task: UniversalPackages@1
  inputs:
    command: 'download' # 'download' | 'publish'. Required. Command. Default: download.
    #adoServiceConnection: # string. Alias: workloadIdentityServiceConnection | azureDevOpsServiceConnection. Optional. Azure DevOps Service Connection.
    #organization: # string. Optional. Use when adoServiceConnection is specified. Organization.
    feed: # string. Required. Feed name (or project/feed).
    packageName: # string. Required. Package name.
    #packageVersion: # string. Optional. Package version.
    #versionIncrement: # 'major' | 'minor' | 'patch'. Optional. Use when command = publish. Version increment.
    directory: '$(System.DefaultWorkingDirectory)' # filePath. Required. Directory. Default: $(System.DefaultWorkingDirectory).
    #packageDescription: # string. Optional. Use when command = publish. Description.
```

<!-- :::syntax-end::: -->

## Inputs

<!-- :::item name="command"::: -->

### `command` - Command

`string`. Required. Allowed values: `download`, `publish`. Default value: `download`.

Specifies the Universal Package command to run: download a package from a feed, or publish a package to a feed.

<!-- :::item-end::: -->

<!-- :::item name="adoServiceConnection"::: -->

### `adoServiceConnection` - Azure DevOps Service Connection

Input aliases: `workloadIdentityServiceConnection`, `azureDevOpsServiceConnection`. `string`. Optional.

The name of an Azure DevOps Service Connection that uses Workload Identity Federation (WIF) to authenticate. When specified, the task uses the service connection identity instead of the pipeline's build service identity. This enables scenarios such as cross-organization feed access and WIF-based authentication without PATs.

If not specified, the task authenticates using the pipeline's built-in build service identity.

See [Setting up an Azure DevOps Service Connection](#setting-up-an-azure-devops-service-connection) for setup instructions.

<!-- :::item-end::: -->

<!-- :::item name="organization"::: -->

### `organization` - Organization

`string`. Optional. Use when `adoServiceConnection` is specified.

The Azure DevOps organization name where the target feed is located (for example, `myorg` from `https://dev.azure.com/myorg`). Use this input when the feed is in a different organization than the one running the pipeline.

When not specified, the task uses the current pipeline's organization.

<!-- :::item-end::: -->

<!-- :::item name="feed"::: -->

### `feed` - Feed name

`string`. Required.

The name of the Azure Artifacts feed. For organization-scoped feeds, specify only the feed name. For project-scoped feeds, use the format `project/feed`, where `project` is the project name and `feed` is the feed name.

<!-- :::item-end::: -->

<!-- :::item name="packageName"::: -->

### `packageName` - Package name

`string`. Required.

The name of the Universal Package to download or publish. Package names must be lower case and can only use letters, numbers, and dashes (`-`).

<!-- :::item-end::: -->

<!-- :::item name="packageVersion"::: -->

### `packageVersion` - Package version

`string`. Optional.

The version of the package. **Required for download**. For publish, specify either this input or `versionIncrement`, but not both.

For downloads, this can be a wildcard expression such as `*` to get the highest version, `1.*` to get the highest version with major version 1, or `1.2.*` to get the highest patch release with major version 1 and minor version 2. Wildcard patterns are not supported with pre-release packages.

<!-- :::item-end::: -->

<!-- :::item name="versionIncrement"::: -->

### `versionIncrement` - Version increment

`string`. Optional. Use when `command = publish`. Allowed values: `major` (Major), `minor` (Minor), `patch` (Patch).

Automatically increments the package version. The task queries the feed for the highest existing version of the package and increments the specified component. Cannot be used together with `packageVersion`.

For new packages (no existing version in the feed), the starting version is:

| Increment | Starting version |
|-----------|-----------------|
| `major`   | `1.0.0`         |
| `minor`   | `0.1.0`         |
| `patch`   | `0.0.1`         |

See the [Semantic Versioning spec](https://semver.org/) for more information.

<!-- :::item-end::: -->

<!-- :::item name="directory"::: -->

### `directory` - Directory

`filePath`. Required. Default value: `$(System.DefaultWorkingDirectory)`.

For downloads, specifies the folder path where the package contents will be downloaded. For publish, specifies the path to the directory containing files to publish.

<!-- :::item-end::: -->

<!-- :::item name="packageDescription"::: -->

### `packageDescription` - Description

`string`. Optional. Use when `command = publish`.

Description of the package contents and/or the changes made in this version of the package.

<!-- :::item-end::: -->

### Task control options

All tasks have control options in addition to their task inputs. For more information, see [Control options and common task properties](/azure/devops/pipelines/yaml-schema/steps-task#common-task-properties).

## Output variables

| Variable | Description |
|----------|-------------|
| `packageName` | The name of the published package. Only set when `command` is `publish`. |
| `packageVersion` | The version of the published package. Only set when `command` is `publish`. Especially useful with `versionIncrement`, where the version is computed at runtime. |

You can reference output variables in downstream steps using the task's reference name. For example, if the task has `name: publishStep`, you can access the version with `$(publishStep.packageVersion)`.

## Remarks

Use this task to download or publish [Universal Packages](/azure/devops/artifacts/quickstarts/universal-packages) in Azure Artifacts feeds.

### Authentication

The task supports two authentication methods:

- **Build service identity (default)**: When no service connection is specified, the task uses the pipeline's built-in build service identity. This is the simplest setup and works for feeds within the same organization.

- **Azure DevOps Service Connection (WIF)**: When `adoServiceConnection` is specified, the task uses Workload Identity Federation to authenticate. This enables cross-organization feed access and eliminates the need for PATs.

### My pipeline needs to access a feed in a different project

If the pipeline is running in a different project than the project hosting the feed, you must set up the other project to grant read/write access to the build service or the service connection identity. See [Package permissions in Azure Pipelines](/azure/devops/artifacts/feeds/feed-permissions#pipelines-permissions) for more details.

### My pipeline needs to access a feed in a different organization

Use the `adoServiceConnection` and `organization` inputs together to access feeds in a different Azure DevOps organization. The service connection must be configured with a Workload Identity Federation credential that has permissions on the target organization's feed.

### Version increment behavior

When using `versionIncrement`, the task queries the feed for the highest existing version of the specified package and increments the appropriate component:

- **patch**: `1.2.3` → `1.2.4`
- **minor**: `1.2.3` → `1.3.0`
- **major**: `1.2.3` → `2.0.0`

If the package doesn't exist yet in the feed, the task starts with the initial version shown in the [versionIncrement input table](#versionincrement---version-increment).

The resolved version is available in the `packageVersion` output variable after the task completes.

> [!NOTE]
> Publishing a package directly to a view is not supported in Azure Artifacts. You must publish the package to your feed first, then promote it to a view.

## Setting up an Azure DevOps Service Connection

<!-- TODO: Replace this section with a link to the public documentation for Azure DevOps Service Connections once available. -->

> [!NOTE]
> Documentation for setting up an Azure DevOps Service Connection with Workload Identity Federation is forthcoming. This section will be updated with a link to the official setup guide when it is publicly available.

To use WIF-based authentication with this task, you need an Azure DevOps Service Connection of type **Workload Identity Federation (user-assigned)**. Once the service connection is created, specify its name in the `adoServiceConnection` input. The identity associated with the service connection must have the appropriate permissions on the target feed (Reader for download, Contributor for publish).

## Examples

### Download a package from an organization-scoped feed

```yaml
steps:
- task: UniversalPackages@1
  displayName: 'Download universal package'
  inputs:
    command: download
    feed: 'my-feed'
    packageName: 'my-package'
    packageVersion: '1.0.0'
    directory: '$(Build.SourcesDirectory)/packages'
```

### Download the latest version of a package

Use a wildcard expression to always download the highest available version:

```yaml
steps:
- task: UniversalPackages@1
  displayName: 'Download latest package'
  inputs:
    command: download
    feed: 'my-feed'
    packageName: 'my-package'
    packageVersion: '*'
    directory: '$(Build.SourcesDirectory)/packages'
```

### Download a package from a project-scoped feed

```yaml
steps:
- task: UniversalPackages@1
  displayName: 'Download from project-scoped feed'
  inputs:
    command: download
    feed: 'my-project/my-feed'
    packageName: 'my-package'
    packageVersion: '2.*'
    directory: '$(Build.SourcesDirectory)/packages'
```

### Publish a package with an explicit version

```yaml
steps:
- task: UniversalPackages@1
  displayName: 'Publish universal package'
  inputs:
    command: publish
    feed: 'my-feed'
    packageName: 'my-app'
    packageVersion: '1.0.0'
    directory: '$(Build.ArtifactStagingDirectory)'
    packageDescription: 'Initial release of my-app'
```

### Publish a package with automatic version increment

Use `versionIncrement` to automatically bump the version based on what's already in the feed:

```yaml
steps:
- task: UniversalPackages@1
  name: publishStep
  displayName: 'Publish with auto-increment'
  inputs:
    command: publish
    feed: 'my-project/my-feed'
    packageName: 'my-app'
    versionIncrement: patch
    directory: '$(Build.ArtifactStagingDirectory)'
    packageDescription: 'Automated build $(Build.BuildNumber)'

- script: echo "Published version $(publishStep.packageVersion)"
  displayName: 'Display published version'
```

### Download using a service connection (WIF)

Authenticate with Workload Identity Federation instead of the build service identity:

```yaml
steps:
- task: UniversalPackages@1
  displayName: 'Download with WIF auth'
  inputs:
    command: download
    adoServiceConnection: 'my-ado-service-connection'
    feed: 'my-feed'
    packageName: 'my-package'
    packageVersion: '1.0.0'
    directory: '$(Build.SourcesDirectory)/packages'
```

### Access a feed in a different organization

Use `adoServiceConnection` with `organization` to download or publish across organizations:

```yaml
steps:
- task: UniversalPackages@1
  displayName: 'Download from another org'
  inputs:
    command: download
    adoServiceConnection: 'cross-org-connection'
    organization: 'other-org'
    feed: 'shared-project/shared-feed'
    packageName: 'shared-tools'
    packageVersion: '*'
    directory: '$(Build.SourcesDirectory)/tools'
```

### Publish across organizations with auto-increment

```yaml
steps:
- task: UniversalPackages@1
  name: crossOrgPublish
  displayName: 'Publish to another org'
  inputs:
    command: publish
    adoServiceConnection: 'cross-org-connection'
    organization: 'other-org'
    feed: 'shared-feed'
    packageName: 'my-library'
    versionIncrement: minor
    directory: '$(Build.ArtifactStagingDirectory)'
    packageDescription: 'Cross-org publish from $(Build.Repository.Name)'
```

## Requirements

| Requirement | Description |
|---|---|
| Pipeline types | YAML, Classic build, Classic release |
| Runs on | Agent, DeploymentGroup |
| Demands | None |
| Capabilities | This task does not satisfy any demands for subsequent tasks in the job. |
| Command restrictions | Any |
| Settable variables | Any |
| Agent version | 4.248.0 or greater |
| Task category | Package |
