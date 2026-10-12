# Pipeline artifact Node task migration

This document explains the approach, implementation, and tests for the pipeline
artifact task migration prototype. For agent setup, task upload, example YAML,
and instructions for rerunning the live tests, see the
[development task runbook](pipeline-artifact-development-tasks.md).

## Scope and current status

The prototype introduces two separate preview tasks:

| Task | Implementation | Execution |
|---|---|---|
| `PublishPipelineArtifactDev@1` | [PublishPipelineArtifactDevV1](../Tasks/PublishPipelineArtifactDevV1/) | Node24 |
| `DownloadPipelineArtifactDev@2` | [DownloadPipelineArtifactDevV2](../Tasks/DownloadPipelineArtifactDevV2/) | Node24 |

Both require agent version 4.265.1 or later and an explicit `artifactToolPath`.
They are development tasks, not replacements deployed under the production IDs.
Existing `PublishPipelineArtifact@1`, `DownloadPipelineArtifact@2`, YAML
`publish`/`download` shortcuts, and agent plug-in registrations remain unchanged.

The implementation is split between this repository and a companion ArtifactTool
change. The tasks use a local development executable containing those changes;
they do not assume the service-downloaded tool already supports them.

## Approach

The goal is to move task orchestration into ordinary Node tasks while retaining
the native artifact client for pipeline-artifact transfer.

```text
Pipeline inputs and job context
             |
             v
Node task entry point
             |
             v
Shared orchestration
  |-- validate inputs and resolve paths
  |-- resolve project, pipeline, and source run
  |-- obtain artifact metadata and dispatch by resource type
  |-- report task results and output variables
  |
  +-- PipelineArtifact --> ArtifactTool --> dedup/blob transfer + association
  +-- Container --------> Azure DevOps Node SDK --> streamed file downloads
  +-- filepath ---------> filesystem / robocopy --> file-share operations
```

"Thin" refers to keeping dedup storage and transfer logic out of TypeScript. It
does not mean that each task can be replaced with a single CLI invocation.
Download V2 supports build/container and file-share artifacts as well as pipeline
artifacts, so the Node task must retain resource dispatch and adapters.

The tasks use normal task targeting. A step can run on the host or in a selected
container; the task invokes ArtifactTool in that same target. A Windows host can
target Linux container steps, provided the image supplies Node24 and the tool is
a Linux executable. Host/container path translation remains the agent's job.

### Responsibility split

| Responsibility | Owner |
|---|---|
| Inputs, aliases, defaults, validation, and task messages | Node task |
| Current/specific/latest/triggering run selection | Node task and Azure DevOps Node SDK |
| Named/all-artifact resource enumeration | Node task; ArtifactTool also enumerates pipeline resources for its all-artifact mode |
| Dedup upload/download, manifests, domains, and pipeline artifact association | ArtifactTool |
| Container-artifact downloads and Windows file-share copies | Node adapters |
| Output variables and task completion | Node task |
| Tool release, acquisition, and deployment policy | Not implemented by this local-build prototype |

## OS, architecture, and container coverage

The migration needs to cover the environment where the task executes, not just
the machine where the agent listener runs. CPU architecture and the Linux C
runtime are part of that contract.

### Agent host platforms versus ArtifactTool targets

The agent's published 5.280.0 packages and current build configuration cover ten
runtime identifiers (RIDs). ArtifactTool's build/release pipeline currently
configures seven corresponding modern targets:

| Agent host platform | Agent RID | Node24 packaged by the agent | ArtifactTool build/release target |
|---|---|---|---|
| Windows x64 | `win-x64` | Yes | Present |
| Windows ARM64 | `win-arm64` | Yes | Present |
| Windows x86 | `win-x86` | **No** | **Missing** |
| Linux glibc x64 | `linux-x64` | Yes | Present |
| Linux glibc ARM64 | `linux-arm64` | Yes | Present |
| Linux glibc ARM32 / ARMv7 | `linux-arm` | **No** | **Missing** |
| Linux musl x64, e.g. Alpine | `linux-musl-x64` | Yes | Present |
| Linux musl ARM64 | `linux-musl-arm64` | Yes | **Missing** |
| macOS x64 | `osx-x64` | Yes | Present |
| macOS ARM64 | `osx-arm64` | Yes | Present |

This is a package/build-target comparison, not a guarantee of compatibility with
every version of an OS or distribution. Those versions must also satisfy the
agent, Node, .NET, and native artifact client's runtime requirements.

The source of truth is the
[agent RID list](https://github.com/microsoft/azure-pipelines-agent/blob/master/src/dev.sh)
and [Node packaging logic](https://github.com/microsoft/azure-pipelines-agent/blob/master/src/Misc/externals.sh),
along with ArtifactTool's
[build matrix](https://dev.azure.com/mseng/AzureDevOps/_git/ArtifactTool?path=%2Fpipelines%2FArtifactTool.1ESPT.Template.yaml)
and [release registration](https://dev.azure.com/mseng/AzureDevOps/_git/ArtifactTool?path=%2Fpipelines%2FArtifactTool.1ESPT.ReleaseTemplate.yaml).
ArtifactTool's project-level RID list is shorter than its pipeline matrix: ARM64
RIDs are supplied by the pipeline. Adding those existing ARM64 targets again would
not close the missing-platform gaps.

The Node24-only prototype cannot claim Windows x86 or Linux ARM32 parity.
Adding ArtifactTool binaries for those platforms would not resolve the absent
Node24 handler runtime; they need an explicit task-runtime compatibility decision.

### Agent running inside a container

In this model, Docker supplies the agent's machine environment, and the pipeline
uses ordinary jobs:

- A Linux image needs Linux agent/tool binaries for its CPU architecture and
  glibc or musl runtime.
- A Windows image needs Windows binaries and a supported image/host configuration.
- There is no separate Docker RID or ArtifactTool build.
- An agent running inside Docker does not imply support for nested Azure Pipelines
  container jobs.

This is the model exercised by the Docker-hosted Linux agent in run 947.

### Host agent targeting container steps or jobs

| Agent host | Container target |
|---|---|
| Linux | Linux images with compatible architecture, runtime, and prerequisites. |
| Windows | Windows or Linux images, depending on the Docker backend and supported host/image configuration. |
| macOS | Azure Pipelines container jobs are not documented as supported. Linux-container handling in source is not a support commitment. |

Linux images used with a Windows agent must provide Node themselves; these tasks
require Node24. Nonglibc images also need compatible Node and native libraries.
Windows images require compatible host/image versions or a supported isolation
configuration. The table does not promise every architecture cross-combination,
Windows ARM64 container support, or emulation-based execution. See the
[container job prerequisites](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/container-phases?view=azure-devops).

Tool selection must use the actual task target's OS, architecture, and Linux
runtime flavor. Host variables such as `Agent.OS` are not sufficient by themselves.
For example, a Windows x64 host can execute a Linux x64 step that needs
`linux-x64`, while a musl ARM64 image needs `linux-musl-arm64` rather than the
host's tool. The local-path prototype leaves this selection to the test setup;
an eventual acquisition implementation must determine it for each target.

### Required additions and validation

1. **Add `linux-musl-arm64`** to ArtifactTool build, packaging, release registration,
   and execution tests. This is the immediate binary gap for the Node24-capable
   agent platform set.
2. **Decide Windows x86 and Linux ARM32 compatibility.** Full agent-platform parity
   requires both ArtifactTool targets and a viable task handler/runtime strategy.
   Do not implicitly remove those platforms by switching production tasks to Node24.
3. **Exercise all eight Node24-capable target combinations:** Windows x64/ARM64,
   Linux glibc x64/ARM64, Linux musl x64/ARM64, and macOS x64/ARM64. A successful
   cross-publish does not establish that native dedup dependencies work at runtime.
4. **Test container ABI and targeting separately:** glibc and musl images, Windows
   images, and host/container path mapping. Binaries, image prerequisites, and
   execution-test coverage are separate deliverables.

Current live coverage establishes Windows x64 host execution and glibc Linux x64
execution, including the Docker-hosted agent, selected Linux steps on Windows,
and full Linux container jobs. ARM64, ARM32, Windows x86, musl, macOS, and
Windows-container execution have not been verified by these prototype E2E runs.

## Implementation map

The entry points deliberately contain very little logic:

- [publish.ts](../Tasks/PublishPipelineArtifactDevV1/publish.ts) connects the
  runtime, service, and tool to `publishArtifacts`.
- [download.ts](../Tasks/DownloadPipelineArtifactDevV2/download.ts) connects the
  same components to `downloadArtifacts`.
- [Publish task manifest](../Tasks/PublishPipelineArtifactDevV1/task.json) and
  [download task manifest](../Tasks/DownloadPipelineArtifactDevV2/task.json)
  declare distinct IDs, Node24 handlers, inputs, aliases, and localized messages.

Shared code lives in
[PipelineArtifactDev](../Tasks/Common/PipelineArtifactDev/):

| File | Purpose |
|---|---|
| [runtime.ts](../Tasks/Common/PipelineArtifactDev/runtime.ts) | Injectable task runtime; variable/input parsing, IDs, patterns, path resolution, and destination checks. |
| [service.ts](../Tasks/Common/PipelineArtifactDev/service.ts) | Injectable artifact service backed by the Azure DevOps Node SDK; project/definition/run lookup, association, and container APIs. |
| [tool.ts](../Tasks/Common/PipelineArtifactDev/tool.ts) | Local executable validation, subprocess execution, job-token environment, cancellation, robocopy, and task lifecycle. |
| [artifacts.ts](../Tasks/Common/PipelineArtifactDev/artifacts.ts) | Publish/download orchestration, run selection, properties, and resource adapters. |
| [index.ts](../Tasks/Common/PipelineArtifactDev/index.ts) | Common module exports. |

Each task's `make.json` references this common module through the existing
repository build mechanism. The module is compiled and packed into the task
dependencies; no separate published npm package is required. Builds also generate
localized manifests and English resource strings.

### Publishing

For `artifactType: pipeline`, the task:

1. Requires Azure DevOps Services and a build job.
2. Validates the current project/run/job context and a file or directory source.
3. Resolves relative sources against `System.DefaultWorkingDirectory`.
4. Uses the supplied artifact name or normalizes `System.JobIdentifier`, removing
   `.default` and characters outside the existing identifier convention.
5. Parses custom properties as a JSON object of string values with `user-` keys.
6. Invokes `pipelineartifact publish` with project, run ID, name, source, and job ID.
7. Passes nonempty custom properties through a uniquely created temporary JSON
   file, deleting the temporary directory on success or failure.

The task forwards the existing pipeline artifact domain override when present.
ArtifactTool selects the effective domain, hash type, parallelism, and redirect
timeout from its client settings, performs the upload, and associates the result
with the run.

Association submits `RootId`, `ProofNodes`, `artifactsize`, `HashType`, `DomainId`,
and custom properties. The publishing job ID is stored as the artifact's `Source`.
The service does not return `ProofNodes` in artifact GET responses.

For `artifactType: filepath`, the Windows adapter creates the artifact directory,
associates the artifact before copying, and invokes robocopy. Directory publishing
copies the directory contents; single-file publishing passes that filename so it
does not copy sibling files. Parallelism defaults to one when disabled and eight
when enabled without an explicit count. Counts outside 1-128 are clamped with a
warning. Robocopy exit codes 0-7 are accepted; larger codes fail the task.

### Selecting a download run

`resolveRun` supports:

- **Current:** `System.TeamProjectId` and `Build.BuildId`.
- **Specific:** a supplied run ID after resolving the project.
- **Latest:** a definition name/ID, tags, and allowed result filters.
- **Latest from branch:** the same selection with the requested branch.
- **Prefer triggering pipeline:** matching build or release artifact variables;
  otherwise fall back to the configured run version.

Latest selection orders builds by descending finish time. Succeeded builds are
included by default; partially succeeded, failed, and canceled results can be
added independently. A malformed matching triggering ID fails explicitly rather
than selecting a different run.

### Downloading and resource dispatch

The task fetches one named resource or all resources, validates their names and
types, and creates the destination before dispatching:

| Resource | Transfer path | Named layout | All-artifact layout |
|---|---|---|---|
| `PipelineArtifact` | ArtifactTool | Files directly under the target | An artifact-named subdirectory |
| `Container` | Node SDK metadata and file streams | Strip the container root; write under the target | An artifact-named subdirectory |
| `filepath` | Windows filesystem copy | An artifact-named subdirectory | An artifact-named subdirectory |

Pipeline resources are delegated in one CLI invocation. ArtifactTool groups
manifests by their recorded storage domain. Artifacts without `DomainId` use the
legacy default domain, not the service's current publish domain.

Container adapters enumerate metadata and filter before downloading selected file
streams. File-share adapters enumerate the source artifact directory and copy
selected files. Both stage each file in a temporary directory beside its
destination, rename after completion, and remove temporary files on failure.
These adapters are sequential in the prototype.

Empty pattern input becomes `**`; multiline inputs accept LF or CRLF. Matching is
resource-specific:

- Pipeline artifacts use the dedup client's matching behavior. Multi-artifact
  matching includes artifact-name prefixes; named matching does not. Negated
  patterns are not subtracted from earlier includes. Positive patterns can select
  an exact subset.
- Container/file-share adapters use task-lib matching with dotfiles enabled,
  brace expansion disabled, and case-sensitive matching. Container matching uses
  the container item paths; file-share matching includes the artifact name.

Unknown resource types fail explicitly. An empty artifact list completes with a
diagnostic and no transfer.

### Authentication, execution, and outputs

`taskMain` obtains the service URL and job access token from
`SYSTEMVSSCONNECTION`. The Node SDK uses the same job credential and receives the
task's proxy/certificate configuration. Its request options allow retries with a
maximum of three.

ArtifactTool is invoked using an argument array with `shell: false`. The token
is passed through a child environment variable; `--patvar` contains the variable
name, not the token. Subprocess output is UTF-8 decoded and line-prefixed for
readability. ArtifactTool nonzero exit codes become task failures.

SIGINT/SIGTERM abort subprocesses. Adapter writes use the abort signal and clean
up staged files; SDK metadata requests are not immediately interruptible.

The download task preserves:

- `BuildNumber`: the selected **build ID**, set after run resolution. It is a
  declared task output; name the step and use `$(downloadStep.BuildNumber)`.
- `DownloadPipelineArtifactResourceTypes`: the distinct downloaded resource types,
  set only after successful transfer.

## Tests

The test strategy separates mocked orchestration, real local CLI invocation, and
live pipeline transfer. Their evidence is not interchangeable.

### L0: orchestration and local runtime behavior

The last Windows validation on October 12, 2026 passed **60 task cases**:

| Suite | Cases | Main coverage |
|---|---|---|
| [Publish L0](../Tasks/PublishPipelineArtifactDevV1/Tests/L0.ts) | 38 | Metadata/arguments, files/directories, default names, relative paths, custom property cleanup, domain override, Windows file-share association/copy, invalid inputs, subprocess arguments/authentication, cancellation, and packaged entry-point failures. |
| [Download L0](../Tasks/DownloadPipelineArtifactDevV2/Tests/L0.ts) | 22 | Run selection, branch/tags/results, triggering fallback, outputs, patterns, mixed-resource dispatch, layouts, stream failures, empty results, cancellation, and packaged entry-point failures. |

Tests inject `TaskRuntime`, `ArtifactService`, and `ArtifactTool` rather than
requiring a live organization. Some cases exercise real temporary files and
child processes. Windows file-share cases skip on other platforms. The repository
runner also passed 45 harness cases, separate from the 60 task cases.

### L1: real local ArtifactTool command parsing

[Publish L1](../Tasks/PublishPipelineArtifactDevV1/Tests/L1.ts) contains **two
passing smoke cases** against the actual local executable:

1. Publish accepts the new metadata, property-file, domain, and hash options.
2. Download accepts repeated patterns.

Both deliberately supply run ID zero and assert exit code 2 and the run-ID
validation diagnostic. They verify CLI discovery/parsing without reaching the
service or reading a properties file. The suite skips when
`PIPELINE_ARTIFACT_DEV_TOOL` is unset.

The companion ArtifactTool changes add 42 regression cases for publish metadata,
properties, service settings, domain selection, layouts/pattern options, errors,
and cancellation. Its last full solution validation passed 210 tests, including
80 in the CLI test project.

### Live E2E: actual transfers and builds

The existing `ba_attack` repository and pipeline definitions were reused on
`test/artifacttool-node-e2e-20261010`. No new repository or pipeline definition was
created, and default branches were not changed. Runs on October 10 succeeded:

| Run | Layout | Assertions |
|---|---|---|
| [943](https://dev.azure.com/jerickmsft/EnterpriseVisible/_build/results?buildId=943) | Windows publisher | New/new, old/new, and new/old transfers; `.artifactignore`; positive selection and reference matching parity; mixed pipeline/container/local-share layouts; outputs; service-visible metadata. |
| [944](https://dev.azure.com/jerickmsft/EnterpriseVisible/_build/results?buildId=944) | Windows cross-run consumer | Mixed resources from run 943, source build output, and reference download of Node publication. |
| [947](https://dev.azure.com/jerickmsft/EnterpriseVisible/_build/results?buildId=947) | Linux agent running inside Docker | Ordinary pipeline steps compile a .NET application, perform Node/reference and mixed downloads, compare compiled-file hashes, execute the downloaded application, and check outputs/metadata. |
| [948](https://dev.azure.com/jerickmsft/EnterpriseVisible/_build/results?buildId=948) | Windows agent with selected Linux container steps | Host and container OS assertions, shared workspace mapping, transfers in both directions, compiled-file hashes, outputs, and application execution inside Linux. |
| [949](https://dev.azure.com/jerickmsft/EnterpriseVisible/_build/results?buildId=949) | Two Linux container jobs on the Windows agent | Separate publisher/consumer targets; mixed layouts; Node/reference interoperability; compiled-file hashes; application execution; positive filtering. |
| [950](https://dev.azure.com/jerickmsft/EnterpriseVisible/_build/results?buildId=950) | Original cross-run mode rerun | Confirms the original consumer path still works after adding container templates. |

An agent whose machine is a Docker container runs ordinary jobs in run 947. That
is different from Azure Pipelines selecting container step/job targets in runs
948-949.

Linux tests use a Linux x64 ArtifactTool build and an image containing Node24.14.0,
.NET SDK 10.0.401, and PowerShell. The Windows executable is not reused in Linux.
On the Windows agent, Linux assertion scripts use the Bash task to launch Linux
`pwsh`, avoiding selection of a Windows PowerShell handler.

### Reproducing build and local tests

From the tasks repository root:

```powershell
node .\make.js build --task "{PublishPipelineArtifactDevV1,DownloadPipelineArtifactDevV2}" --BypassNpmAudit
node .\make.js test --task "{PublishPipelineArtifactDevV1,DownloadPipelineArtifactDevV2}" --suite L0

$env:PIPELINE_ARTIFACT_DEV_TOOL = 'Q:\ArtifactTool\src\ArtifactTool\bin\Debug\net10.0\artifacttool.exe'
node .\make.js test --task PublishPipelineArtifactDevV1 --suite L1
```

The audit bypass is explicit for this development prototype because an upstream
dependency audit finding remains unresolved; it is not a passing audit. The
October 12 build attempts encountered intermittent Windows dependency-directory
rename locks. Both packages ultimately built successfully, and L0/L1 passed.
The [runbook](pipeline-artifact-development-tasks.md) explains common-module
cache handling and task upload.

## What remains before production adoption

- Choose and release the required ArtifactTool version, then replace local-path
  acquisition with the approved distribution mechanism.
- Decide how and when to migrate production task identities, minimum agent
  requirements, pinned task versions, YAML shortcuts, and automatic downloads.
- Close the `linux-musl-arm64` tool gap, decide Windows x86/Linux ARM32 task
  compatibility, and complete the OS/architecture execution matrix above.
- Complete matching/layout coverage across resource types, including empty
  directories and file-share behavior outside the local Windows test setup.
- Validate Windows containers, other architectures, non-default domains, remote
  SMB shares, native proxy/certificate behavior, and cancellation under live load.
- Measure cold/warm startup, throughput, memory, and adapter concurrency before
  setting rollout budgets.
- Resolve the dependency audit gate and finish the normal implementation reviews.

The result so far is a working development implementation with verified Windows
and Linux transfer/build scenarios, not a production handler cutover.
