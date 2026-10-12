# Local ArtifactTool development tasks

These **test-only** tasks exercise the Node migration without changing production
`PublishPipelineArtifact@1`, `DownloadPipelineArtifact@2`, YAML shortcuts, or agent
plug-in registrations:

| Task | Version | Test-only ID |
|---|---|---|
| `PublishPipelineArtifactDev` | 1 | `e049b461-bf9e-494b-93b6-bfe5ce2a461a` |
| `DownloadPipelineArtifactDev` | 2 | `169fc531-05b5-49ec-ae60-1df9f44948a6` |

The manifests declare only Node24 and require agent 4.265.1 or later. They use
normal task targeting, including containers. They do not download a tool, search
PATH for ArtifactTool, launch the plug-in host, or fall back to a production task.

## Prerequisites

- A trusted local ArtifactTool development executable with publish custom
  properties/job metadata, domain-aware clients, and filtered multi-artifact
  downloads. The baseline service-downloaded tool is not assumed to support these.
- A test Azure DevOps Services organization and an agent with Node24.
- The executable **and all its supporting files** available inside the task target.
  For containers, mount/copy the build into the container and use the container's
  absolute path, not the host path.
- Debug/framework-dependent ArtifactTool builds require the matching .NET runtime
  inside the target. Self-contained Release builds must match its OS/architecture
  and native-library requirements.
- A job token with permissions for the selected run/project. The task obtains it
  from `SYSTEMVSSCONNECTION`; no PAT task input or command-line token is used.

Never point these tasks at an untrusted executable or use them in production.
An explicit local path is a development convenience, not executable provenance
verification or a sandbox.

## Build and local validation

From the ArtifactTool repository root, first build and test the local source:

```powershell
dotnet build .\src\ArtifactTool.sln
dotnet test .\src\ArtifactTool.sln
```

From the tasks repository root:

```powershell
node .\make.js build --task "{PublishPipelineArtifactDevV1,DownloadPipelineArtifactDevV2}" --BypassNpmAudit
node .\make.js test --task "{PublishPipelineArtifactDevV1,DownloadPipelineArtifactDevV2}" --suite L0

# Point to your own local build. No credentials or network calls are used by L1.
$env:PIPELINE_ARTIFACT_DEV_TOOL = 'Q:\ArtifactTool\src\ArtifactTool\bin\Debug\net10.0\artifacttool.exe'
node .\make.js test --task PublishPipelineArtifactDevV1 --suite L1
```

The normal build **currently fails its npm audit**: the current task SDK dependency
chain `azure-pipelines-task-lib -> shelljs -> fast-glob -> micromatch -> braces`
is reported for a high-severity nested-pattern denial of service
([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)).
The build command above uses the repository's explicit audit bypass only for this
development prototype. It is not a passing audit or a production approval.
Do not use a forced SDK downgrade as a speculative workaround.

The shared module is built/packed through the existing `make.json` common-module
mechanism. When changing common source, remove only the cached output for
`_build\Tasks\Common\PipelineArtifactDev` and its
`_build\Tasks\Common\pipeline-artifact-dev-common-0.0.1.tgz` before rebuilding.
Do not delete the entire shared common output or other tasks.

## Upload only the test identities

The build outputs are `_build\Tasks\PublishPipelineArtifactDevV1` and
`_build\Tasks\DownloadPipelineArtifactDevV2`. Upload them with the existing TFX task
upload workflow to a test organization; preserve the new test IDs above. Do not
overwrite the production task IDs.

Configure TFX authentication through its normal login flow; never place a token
in checked-in scripts or examples:

```powershell
tfx build tasks upload --task-path .\_build\Tasks\PublishPipelineArtifactDevV1
tfx build tasks upload --task-path .\_build\Tasks\DownloadPipelineArtifactDevV2
```

## Example test pipeline

Use a self-hosted test agent where the local build is already available. Set
`ArtifactToolDevPath` to the absolute path inside the task target.

```yaml
trigger: none

pool:
  name: ArtifactDevelopment

variables:
  ArtifactToolDevPath: 'Q:\ArtifactTool\src\ArtifactTool\bin\Debug\net10.0\artifacttool.exe'

steps:
- powershell: |
    New-Item -ItemType Directory -Force "$(Pipeline.Workspace)\dev-input"
    Set-Content "$(Pipeline.Workspace)\dev-input\hello.txt" "hello"
  displayName: Create test artifact

- task: PublishPipelineArtifactDev@1
  inputs:
    artifactToolPath: '$(ArtifactToolDevPath)'
    targetPath: '$(Pipeline.Workspace)\dev-input'
    artifact: dev-drop
    properties: '{"user-purpose":"node-migration-test"}'

- task: DownloadPipelineArtifactDev@2
  name: downloadDev
  inputs:
    artifactToolPath: '$(ArtifactToolDevPath)'
    buildType: current
    artifactName: dev-drop
    itemPattern: '**/*.txt'
    targetPath: '$(Pipeline.Workspace)\dev-download'

- powershell: |
    if ((Get-Content "$(Pipeline.Workspace)\dev-download\hello.txt") -ne "hello") {
      throw "Artifact round trip did not match."
    }
  displayName: Verify contents
```

Aliases are retained in the manifests and normalized by the agent, as for normal
tasks. Download `BuildNumber` intentionally contains the selected **build ID**.
Because it is a declared task output, reference it as `$(downloadDev.BuildNumber)`
after naming the download step `downloadDev`, not as `$(BuildNumber)`.
`DownloadPipelineArtifactResourceTypes` is set only after successful downloads.

## Behavior and remaining parity gates

- Publish supports files/directories, normalized default job names, custom
  properties via a temporary JSON file, and the existing domain override variable.
- Download selects current/specific/latest/latest-from-branch/triggering runs,
  with project/pipeline name lookup, tags, and result filters.
- Pipeline artifact matching and domain-aware transfer are delegated to ArtifactTool.
  Named pipeline artifacts download directly to the target; multi-download includes
  artifact-name prefixes for patterns and layout.
  Pipeline artifact patterns retain the dedup client's any-pattern behavior:
  negated patterns are not a subtraction of previously included matches. Compare
  against the reference task, and use positive path patterns to select only a subset.
- Container artifacts use the existing Node SDK file-container API, filter metadata
  before transfer, and strip the container root for named downloads. File-share
  downloads retain their artifact subdirectory even for named downloads.
- Windows file-share publish associates the artifact before copying for retention
  compatibility. Robocopy codes 0-7 are successful; larger codes fail. Parallelism
  is clamped to 1-128 with a warning.
- File-share downloads are Windows-only in this prototype. Container/file-share
  adapters are sequential and use task-lib matching with dotfiles enabled and brace
  expansion disabled. Exact matching, empty-directory behavior, retries, performance,
  and cross-platform parity still require E2E comparison with the agent.
- Name validation is always strict here. Invalid or unknown artifact resources
  fail explicitly rather than silently skipping or falling back.
- Adapter destination paths reject traversal and existing symlinks/junctions.
  Temporary files are cleaned up on failure. This is not protection against all
  concurrent filesystem races; ArtifactTool's manifest extraction needs its own
  live boundary validation.
- Subprocesses are spawned without a shell, with a child-only token environment.
  Tool output is line-prefixed for readability, not command isolation: the agent
  searches for logging-command markers anywhere in a line. Child-output command
  handling remains a security-hardening gate before production use.
  SIGINT/SIGTERM abort the child; SDK metadata requests are bounded by the SDK
  retry policy and are not immediately interruptible.
- Proxy/certificate settings are passed to the Node SDK. ArtifactTool native
  proxy/certificate behavior remains an E2E gate, not an assumed guarantee.

This prototype is not a security mitigation rollout. Host Node tasks retain the
agent user's filesystem permissions and the job token's service permissions.
Containers reduce host exposure only to the extent that their mounts and runtime
privileges restrict it. Native pipeline-artifact publish/extraction symlink
handling, concurrent filesystem races, and producer/consumer authorization
boundaries need dedicated security regressions; the benign E2E runs below do not
establish that those attack paths are fixed.

Local L0/L1 tests do not establish live job-token authentication, artifact transfer
parity, container operation, supported architectures, or production readiness.
Validate old-publish/new-download, new-publish/old-download, and new/new round trips,
mixed resource types, output-variable references, cancellation, performance, and
the dependency audit before changing any production handler.

## Verified local Windows E2E setup

On October 10, 2026, these tasks were uploaded to the existing
`jerickmsft/EnterpriseVisible` project and exercised on a dedicated local agent.
No repository or pipeline definition was created, and existing default branches
were not changed.

- Repository: `ba_attack`.
- Test branch:
  [test/artifacttool-node-e2e-20261010](https://dev.azure.com/jerickmsft/EnterpriseVisible/_git/ba_attack?version=GBtest%2Fartifacttool-node-e2e-20261010).
- Pool: `ArtifactTool-Node-E2E-20261010` (pool 21, project queue 77).
- Agent: `artifact-node-e2e-local` (10636), official Windows x64 agent 5.280.0.
- Only existing pipelines 48 (`victim`, publisher) and 45 (`victim-pa-poc`, consumer)
  are authorized for the new pool.
- Agent directory: `Q:\copilot-worktrees\artifact-node-e2e-agent-20261010`.
- Local test branch checkout:
  `Q:\copilot-worktrees\ba_attack-artifact-e2e-20261010`.

Successful runs:

| Run | Existing pipeline | Verified |
|---|---|---|
| [943](https://dev.azure.com/jerickmsft/EnterpriseVisible/_build/results?buildId=943) | 48 | New/new, old/new, new/old, `.artifactignore`, positive file selection, matching-pattern parity, mixed pipeline/container/local file-share layouts, output variables, and service-visible publish metadata. |
| [944](https://dev.azure.com/jerickmsft/EnterpriseVisible/_build/results?buildId=944) | 45 | Cross-run mixed-resource downloads from run 943, selected build ID output, and reference plug-in download of the Node-published artifact. |

The service returned identical content manifests, content sizes, hash types, and
storage domains for the new/reference publishers. `ProofNodes` is submitted during
association but is not exposed by either publisher's artifact GET response; tests
check the service-visible metadata instead of assuming it is returned.

To rerun, queue pipeline 48 on the test branch. After it succeeds, queue pipeline 45
on the same branch with `sourceRunId` set to that publisher's build ID. Both branch
YAML files explicitly target the dedicated pool and agent. The file-share test uses
local filesystem paths on that agent, not a remote SMB service.

The agent runs interactively, not as a service. To restart it locally, use:

```powershell
& 'Q:\copilot-worktrees\artifact-node-e2e-agent-20261010\run-e2e.ps1'
```

The restart script clears `PSModulePath` only in the listener's process environment
and restores the caller's value when it exits. This avoids an inherited PowerShell 7
module-path conflict in the Windows PowerShell task host. Branch assertion steps
run with `pwsh`; no machine-wide PowerShell configuration was changed.

These successful runs establish the Windows/default-domain/local-filesystem
scenarios above, not container, other-platform, non-default-domain, remote-share,
performance, cancellation E2E, or production readiness. The upstream dependency
audit finding remains a production blocker.

## Container layouts

Linux containers can run under the Windows agent; they must provide a compatible
Node runtime. The test image includes Node24.14.0, .NET SDK 10.0.401, and PowerShell.
Its build definition is `e2e/Dockerfile.linux` on the E2E branch. This is distinct
from running the agent itself in a Docker container.

Pipeline 45 on the same test branch accepts `testMode`:

| Mode | Agent and execution location |
|---|---|
| `crossRun` (default) | Original cross-run checks on the Windows agent; supply `sourceRunId`. |
| `linuxAgent` | Ordinary jobs on a Linux agent whose machine is a Docker container. No pipeline job container or Docker socket is used. |
| `linuxSteps` | Windows agent with selected steps targeted into a Linux container and other steps on the Windows host. |
| `linuxContainer` | Windows agent with two entire Linux container jobs. |
| `windowsContainer` | Windows agent with Windows Hyper-V-isolated container jobs; requires Windows Docker mode and compatible virtualization. |

The Linux tests use a separate self-contained Linux x64 local ArtifactTool build,
not the Windows executable. It is mounted read-only at `/artifacttool-dev`.
The default local image is `artifact-node-e2e:linux-net10-node24`.
Windows container jobs use the Windows executable at `C:\artifacttool-dev`.

The additional Linux agent is `artifact-node-e2e-linux-container` (agent 10637)
in the existing test pool. Its official 5.280.0 package was checked against the
service-provided SHA256 before image build. It runs as UID 1001 (`e2eagent`), with
no privileged mode, no Docker socket mount, and isolated persistent agent state in
the Docker volume `artifact-node-e2e-linux-agent-state-20261010`.

Docker installation/backend enablement may require elevation. The registered
agents, image builds, and pipeline runs use non-elevated Docker access. Restart the
Windows agent after installing Docker so its process sees the Docker CLI and
credential helper; the local `run-e2e.ps1` supplies that PATH without machine-wide
changes.

To restart the additional Docker-hosted agent:

```powershell
& 'Q:\copilot-worktrees\artifact-node-linux-agent-image-20261010\run-linux-agent.ps1'
```

Do not start a second listener for the same agent name or volume. The Windows
agent and this Linux agent have separate registrations/state. Linux modes require
Docker Linux mode; do not switch the daemon to Windows mode while they are running.
The `windowsContainer` mode is optional coverage, not a requirement for Linux tests.

### Successful Linux container runs

All three execution layouts succeeded on pipeline 45 using the same E2E branch:

| Run | Mode | Verified |
|---|---|---|
| [947](https://dev.azure.com/jerickmsft/EnterpriseVisible/_build/results?buildId=947) | `linuxAgent` | Ordinary .NET build on the Docker-hosted Linux agent, Node/reference publishing, named and mixed downloads, compiled-file hashes, application execution, outputs, and metadata. |
| [948](https://dev.azure.com/jerickmsft/EnterpriseVisible/_build/results?buildId=948) | `linuxSteps` | Windows host steps mixed with Linux container steps, Linux compilation/publication, host-to-container and container-to-host transfers, shared paths, output variables, and downloaded application execution inside Linux. |
| [949](https://dev.azure.com/jerickmsft/EnterpriseVisible/_build/results?buildId=949) | `linuxContainer` | Separate publisher/consumer container jobs, Node/reference interoperability, mixed resource layouts, SHA256 build-output checks, application execution, and positive file filtering. |

The first Linux-agent attempt passed every artifact check but had an injected
container-policy warning about an external base-image registry. The test
Dockerfile now uses only the Microsoft registry, downloading Node from the
official Node distribution and verifying its SHA256. Runs 947-949 passed the
injected supply-chain analysis as well as the artifact checks.

One Windows-host/Linux-step attempt also exposed a handler distinction: the
PowerShell task can select its Windows handler from the host even for a
Linux-targeted step. Linux assertion steps therefore use the Node-based Bash task
to invoke Linux `pwsh`; they do not alias `powershell.exe` or run assertions on the
host instead. The new artifact tasks themselves are Node24 handlers and execute
directly in the selected Linux target.

No additional elevation was required: Docker image builds, container starts,
agent registration, and all test runs were performed from a non-elevated session.
Docker remains in Linux mode. Windows-container layouts have not been executed;
they need a separate Windows-engine setup and must not be inferred from these
Linux results.

The original `crossRun` mode was also rerun after the template changes:
[run 950](https://dev.azure.com/jerickmsft/EnterpriseVisible/_build/results?buildId=950)
succeeded while consuming the earlier publisher run 943.
