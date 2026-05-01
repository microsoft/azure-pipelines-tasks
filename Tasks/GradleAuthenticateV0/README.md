# Gradle Authenticate (GradleAuthenticateV0)

## Overview

This task configures Gradle builds to authenticate against Azure Artifacts Maven feeds. It writes a Gradle init script and a local credential-provider JAR layout so that `gradle build` can resolve packages from private Azure Artifacts feeds without manual credential management.

Authentication is supported via:
- **Workload Identity Federation (WIF)** — using an Azure DevOps service connection
- **Access token** — via the `ARTIFACTS_GRADLE_AUTH_ACCESS_TOKEN` or `SYSTEM_ACCESSTOKEN` environment variable

## Usage

### Minimal — auto-discover build files

When no inputs are provided, the task auto-discovers `settings.gradle`, `settings.gradle.kts`, `build.gradle`, and `build.gradle.kts` in the working directory.

```yaml
steps:
- task: GradleAuthenticate@0
```

### Explicit build files

```yaml
steps:
- task: GradleAuthenticate@0
  inputs:
    buildFiles: |
      settings.gradle
      build.gradle
```

### Single feed URL

```yaml
steps:
- task: GradleAuthenticate@0
  inputs:
    repositoryUrl: 'https://pkgs.dev.azure.com/myorg/myproject/_packaging/myfeed/maven/v1'
```

### With Workload Identity Federation

```yaml
steps:
- task: GradleAuthenticate@0
  inputs:
    buildFiles: |
      settings.gradle
    adoServiceConnection: 'my-wif-connection'
```

### With access token

```yaml
steps:
- task: GradleAuthenticate@0
- script: gradle build
  env:
    ARTIFACTS_GRADLE_AUTH_ACCESS_TOKEN: $(System.AccessToken)
```

## Inputs

| Input | Required | Description |
|---|---|---|
| `buildFiles` | No | Newline-separated list of Gradle build files to scan for `pkgs.dev.azure.com` URLs. Should include `settings.gradle` for plugin version discovery. |
| `repositoryUrl` | No | Explicit Azure Artifacts repository URL to authenticate, in addition to any discovered from build files. |
| `adoServiceConnection` | No | Azure DevOps service connection for Workload Identity Federation (WIF). If omitted, the task uses `SYSTEM_ACCESSTOKEN` or `ARTIFACTS_GRADLE_AUTH_ACCESS_TOKEN`. |
| `pluginToolVersion` | No | Override the credprovider plugin version. Use when `settings.gradle` does not declare the plugin or when version resolution fails. |
| `gradleUserHome` | No | Override the Gradle user home directory. Defaults to `~/.gradle`. The init script is written to `<gradleUserHome>/init.d/`. |

At least one of `buildFiles` or `repositoryUrl` must be provided.

## How it works

1. **Feed discovery** — Scans the provided build files for `pkgs.dev.azure.com` URLs and merges them with any explicit `repositoryUrl`.
2. **CI JAR resolution** — Locates the Azure Artifacts Gradle credential provider JAR from the bundled externals shipped with the task. Set `GRADLE_CREDPROVIDER_HOME` to override the JAR location.
3. **Version resolution** — Determines the plugin version from build files, the `pluginToolVersion` input, or the JAR filename.
4. **Maven repo layout** — Creates a local Maven repository containing the credential provider JAR so Gradle can resolve the plugin without network access.
5. **Auth config** — Writes a JSON auth config file with feed credentials (WIF or access token).
6. **Init script** — Writes a Gradle init script to `<gradleUserHome>/init.d/` that registers the local plugin repository, applies the credential provider plugin, and points it at the auth config.
7. **Cleanup** — A post-job step removes the init script, temp directory, and environment variables.

## Environment variables set

| Variable | Description |
|---|---|
| `ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO` | Path to the local Maven repository containing the credential provider |
| `ARTIFACTS_GRADLE_AUTH_CONFIG` | Path to the JSON auth config file |
| `ARTIFACTS_GRADLE_AUTH_INIT_SCRIPT_PATH` | Path to the generated init script |
| `ARTIFACTS_GRADLE_AUTH_TEMP_DIR` | Path to the task's temp working directory |

