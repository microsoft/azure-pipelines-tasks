# Azure Pipelines Task Signing and WDAC Investigation Runbook

## Purpose

This document records the complete investigation into:

- How Azure Pipelines task binaries are signed during release.
- Which tasks and task files need signing.
- How to create an isolated Windows Server 2025 WDAC test environment.
- How Azure Pipelines tasks behave under WDAC Audit and Enforcement modes.
- Why an unsigned file can remain inside a task without immediately blocking the task.
- How to scan downloaded task packages and deliberately exercise unsigned native files.

The investigation did not modify the `azure-pipelines-tasks` repository or bump any task versions.

## Final conclusions

1. WDAC does not reject an entire directory because it contains one unsigned file.
2. WDAC evaluates executable code when Windows executes or loads that specific file.
3. A task can succeed while dormant unsigned `.exe`, `.dll`, or `.node` files remain in its directory.
4. If a conditional code path later loads one of those files, WDAC can block that file and the task will fail.
5. Signing every signable file is a release/compliance guarantee and prevents failures across all task inputs, fallbacks, operating systems, and indirect dependency-loading paths.
6. NuGet-signing a `task.zip` does not give an Authenticode identity to the files extracted from it.
7. The authoritative task contents are the built or published task packages, not only `Tasks\<TaskName>` in the source tree.
8. A task version bump and release are not by themselves proof that all native contents are signed. The final extracted packages must be scanned.
9. The signing pipeline's `signNodeModules` behavior must be considered. If it is disabled, native dependencies under `node_modules` must already be signed or must be covered through another approved mechanism.

## Repository and signing flow

Repository:

```text
C:\Users\dassayantan\repos\azure-pipelines-tasks
```

Important files:

| File | Purpose |
|---|---|
| `.azure-pipelines\.vsts.release.yml` | Release pipeline; enables task signing with `signTasks: true` |
| `ci\build-all-steps.yml` | Builds tasks, invokes file signing, creates task packages, and creates the outer archive |
| `ci\sign-task-files.yml` | Authenticode/script signing rules for files inside tasks |
| `ci\sign-all-tasks.yml` | NuGet-signs individual task ZIP packages |
| `ci\GetMicrosoftSignedFilesScript.ps1` | Detects files that already have valid Microsoft signatures |
| `ci\MoveMicrosoftSignedFilesScript.ps1` | Temporarily moves and restores existing Microsoft-signed files |
| `ci\ci-util.js` | Task package creation logic |
| `make-options.json` | Build task selection and configuration |

### Release flow

The effective sequence is:

1. Build task contents.
2. Include generated files, external tools, common modules, and task dependencies.
3. Preserve files that already contain valid Microsoft signatures.
4. Sign configured scripts and native binaries inside the built task directories.
5. Restore the preserved Microsoft-signed files.
6. Create each task's individual ZIP package.
7. NuGet-sign each individual task ZIP.
8. Place the task ZIPs into the final outer `tasks.zip`.

The final outer `tasks.zip` is a transport container. The meaningful signatures are:

- Authenticode/script signatures on signable files inside each task.
- NuGet signatures on the individual task ZIP packages.

Observed signing certificate configuration:

| Content | Signing key/certificate configuration |
|---|---|
| Microsoft-authored scripts | `CP-230012` |
| Remaining `.exe` and `.dll` native content | Microsoft third-party key `CP-231522` |
| Individual task ZIP packages | NuGet signing key `CP-401405` |

Existing valid Microsoft embedded signatures are preserved rather than overwritten.

### Important `node_modules` caveat

The signing templates support a `signNodeModules` option, and the investigated path defaults it to false unless explicitly enabled by the caller.

This means a successful release does not automatically prove that every native file under `node_modules` was newly signed. Those dependencies may:

- Already carry a valid upstream/Microsoft signature.
- Be replaced by newer signed dependency versions.
- Remain unsigned if excluded from signing.

Therefore, scan the final extracted task package regardless of whether the signing job succeeded.

## Task inventory

The task metadata investigation found:

| Inventory | Count |
|---|---:|
| Total task directories with `task.json` | 224 |
| Active tasks | 157 |
| Deprecated tasks | 67 |
| Tasks listed in `make-options.json` | 220 |
| Active tasks in `make-options.json` | 156 |
| Deprecated tasks in `make-options.json` | 64 |

`AppCenterTestV1` was active but absent from `make-options.json`.

Active task categories:

| Category | Count |
|---|---:|
| Deploy | 50 |
| Utility | 49 |
| Build | 21 |
| Package | 16 |
| Tool | 15 |
| Test | 6 |

Deprecated tasks should not normally receive routine investment, but security/compliance requirements may justify rebuilding or signing them when those task versions are still distributed or supported.

## Selected task sample

The test sample was:

| Task | Category | Version investigated | Status |
|---|---|---:|---|
| PowerShellV2 | Utility | 2.279.0 | Active |
| BashV3 | Utility | 3.278.0 | Active |
| CmdLineV2 | Utility | 2.279.0/2.279.1 | Active |
| BatchScriptV1 | Utility | 1.226.0 | Active |
| ShellScriptV2 | Utility | 2.274.0 | Active |
| CopyFilesV2 | Utility | 2.276.0 | Active |
| DeleteFilesV1 | Utility | 1.274.1 | Active |
| ArchiveFilesV2 | Utility | 2.279.0 | Active |
| GradleV2 | Build | 2.276.0 | Deprecated |
| DotNetCoreInstallerV0 | Tool | 0.276.0 | Deprecated |

## Safety decision: do not test enforcement on the corporate Cloud PC

The initial machine was inspected with:

```powershell
$os = Get-CimInstance Win32_OperatingSystem
$admin = ([Security.Principal.WindowsPrincipal](
    [Security.Principal.WindowsIdentity]::GetCurrent()
)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

[pscustomobject]@{
    ComputerName       = $env:COMPUTERNAME
    WindowsEdition    = $os.Caption
    Version           = $os.Version
    Build             = $os.BuildNumber
    Architecture      = $os.OSArchitecture
    Administrator     = $admin
    CiToolAvailable   = [bool](Get-Command CiTool.exe -ErrorAction SilentlyContinue)
    OSConfigInstalled = [bool](Get-Module -ListAvailable Microsoft.OSConfig)
} | Format-List
```

Observed environment:

```text
Windows 11 Enterprise
Build 26200
64-bit
Administrator: True
CiTool available: True
```

`CiTool.exe -lp` also showed multiple centrally managed enterprise policies. Applying a custom enforcement policy there could have blocked sign-in, PowerShell, management tools, or recovery access. A nested disposable VM was therefore used.

## Nested Hyper-V VM setup

### Confirm Hyper-V

Run on the host in elevated PowerShell:

```powershell
Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All
```

The result showed Hyper-V was enabled.

If needed on another disposable host:

```powershell
Enable-WindowsOptionalFeature -Online `
  -FeatureName Microsoft-Hyper-V-All `
  -All
```

Enabling Hyper-V requires a restart.

### Check host resources and networking

```powershell
Get-CimInstance Win32_ComputerSystem |
Select-Object NumberOfLogicalProcessors,
              @{Name='MemoryGB';Expression={[math]::Round($_.TotalPhysicalMemory/1GB)}}

Get-VMSwitch |
Select-Object Name, SwitchType
```

Observed host resources:

```text
16 logical processors
64 GB RAM
Default Switch available
```

VM allocation selected:

```text
4 virtual CPUs
12 GB RAM
100 GB dynamically expanding disk
```

### Download Windows Server 2025

Download the Windows Server 2025 64-bit Evaluation ISO from:

```text
https://www.microsoft.com/evalcenter/download-windows-server-2025
```

Create an ISO directory:

```powershell
New-Item C:\ISO -ItemType Directory -Force
```

Save or move the downloaded ISO to:

```text
C:\ISO\WindowsServer2025.iso
```

Do not extract the ISO.

### Generation 2 attempt that did not work

The first VM was created as Generation 2:

```powershell
$vm = 'WDAC-Lab'

New-Item C:\Hyper-V -ItemType Directory -Force

New-VM `
  -Name $vm `
  -Generation 2 `
  -MemoryStartupBytes 12GB `
  -NewVHDPath "C:\Hyper-V\$vm.vhdx" `
  -NewVHDSizeBytes 100GB `
  -SwitchName 'Default Switch'

Set-VMProcessor $vm -Count 4
Set-VMMemory $vm -DynamicMemoryEnabled $false
Add-VMDvdDrive $vm -Path C:\ISO\WindowsServer2025.iso
Set-VMFirmware $vm `
  -FirstBootDevice (Get-VMDvdDrive $vm) `
  -EnableSecureBoot On `
  -SecureBootTemplate MicrosoftWindows
Set-VMKeyProtector $vm -NewLocalKeyProtector
Enable-VMTPM $vm
Set-VM $vm -AutomaticCheckpointsEnabled $true
Start-VM $vm
vmconnect.exe localhost $vm
```

The ISO did not boot successfully, including after Secure Boot troubleshooting. The test therefore moved to Generation 1.

### Working Generation 1 VM

```powershell
Stop-VM WDAC-Lab -TurnOff -ErrorAction SilentlyContinue

$vm = 'WDAC-Lab-Gen1'

New-VM `
  -Name $vm `
  -Generation 1 `
  -MemoryStartupBytes 12GB `
  -NewVHDPath "C:\Hyper-V\$vm.vhdx" `
  -NewVHDSizeBytes 100GB `
  -SwitchName 'Default Switch'

Set-VMProcessor $vm -Count 4
Set-VMMemory $vm -DynamicMemoryEnabled $false
Set-VMDvdDrive $vm -Path C:\ISO\WindowsServer2025.iso
Set-VMBios $vm -StartupOrder CD,IDE,LegacyNetworkAdapter,Floppy
Start-VM $vm
vmconnect.exe localhost $vm
```

Click inside the VM console and press Spacebar when prompted to boot from DVD.

### Windows installation choices

1. Keep **Install Windows Server** selected.
2. Confirm the disk can be erased.
3. Select **Windows Server 2025 Datacenter Evaluation (Desktop Experience)**.
4. Accept the license.
5. Select **Custom: Install Microsoft Server Operating System only**.
6. Select the 100 GB unallocated disk.
7. Complete installation and create the Administrator password.
8. Do not press a key to boot from DVD after the first restart.

Installed operating system:

```text
Windows Server 2025 Datacenter Evaluation
Build 26100
```

### Clipboard and enhanced session

For simple command transfer, use:

```text
Virtual Machine Connection -> Clipboard -> Type clipboard text
```

Enhanced-session attempt from the host:

```powershell
Set-VMHost -EnableEnhancedSessionMode $true
Set-VM WDAC-Lab-Gen1 -EnhancedSessionTransportType HvSocket
```

Close and reopen VMConnect, then use **View -> Enhanced Session** if available.

### VM checkpoints

Checkpoints created or recommended during the investigation:

```powershell
Checkpoint-VM WDAC-Lab-Gen1 -SnapshotName 'Clean-Windows-Install'
Checkpoint-VM WDAC-Lab-Gen1 -SnapshotName 'Before-WDAC-Audit'
Checkpoint-VM WDAC-Lab-Gen1 -SnapshotName 'WDAC-Audit-Working'
Checkpoint-VM WDAC-Lab-Gen1 -SnapshotName 'WDAC-Enforcement-Working'
```

The last checkpoint was recommended after confirming enforcement and before further task experiments.

## Basic VM networking

Inside the VM:

```powershell
Test-NetConnection www.microsoft.com -Port 443
Test-NetConnection dev.azure.com -Port 443
```

Observed Azure DevOps result:

```text
ComputerName     : dev.azure.com
RemoteAddress    : 150.171.74.16
RemotePort       : 443
InterfaceAlias   : Ethernet
SourceAddress    : 172.26.27.124
TcpTestSucceeded : True
```

## Create an unsigned native test executable

Inside the VM, elevated PowerShell:

```powershell
Set-Content C:\UnsignedTest.cs @'
using System;

class P
{
    static void Main()
    {
        Console.WriteLine("UNSIGNED PROGRAM RAN");
    }
}
'@

& "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" `
  /nologo `
  /out:C:\UnsignedTest.exe `
  C:\UnsignedTest.cs

Get-AuthenticodeSignature C:\UnsignedTest.exe |
Select-Object Status, Path

C:\UnsignedTest.exe
```

Baseline result:

```text
Status: NotSigned
UNSIGNED PROGRAM RAN
```

This established that the executable was genuinely unsigned and was allowed before the test policy was enabled.

## Install Microsoft.OSConfig

Inside the VM, elevated PowerShell:

```powershell
Install-Module Microsoft.OSConfig -Scope AllUsers -Force
```

When asked to install the NuGet provider, select `Y`.

Verify:

```powershell
Get-Module -ListAvailable Microsoft.OSConfig
```

Installed module:

```text
Microsoft.OSConfig 1.4.4
```

## OSConfig scenario-name correction

The first attempted scenario names were:

```powershell
Set-OSConfigDesiredConfiguration `
  -Scenario AppControl\WS2025\DefaultPolicy\Audit `
  -Default

Set-OSConfigDesiredConfiguration `
  -Scenario AppControl\WS2025\AppBlockList\Audit `
  -Default
```

These failed with:

```text
Cannot find the scenario 'AppControl\WS2025\...'
```

Inspect the installed metadata:

```powershell
Get-ChildItem `
  'C:\Program Files\WindowsPowerShell\Modules\Microsoft.OSConfig\1.4.4' `
  -Recurse -Directory |
Where-Object Name -Like '*AppControl*' |
Select-Object FullName
```

Display the exact scenario directory names:

```powershell
Get-ChildItem `
  'C:\Program Files\WindowsPowerShell\Modules\Microsoft.OSConfig\1.4.4\metadata' `
  -Directory |
Where-Object Name -Like '*AppControl*' |
Select-Object -ExpandProperty Name
```

The installed module used:

```text
AppControl\WindowsServer\2025\DefaultPolicy\Audit
AppControl\WindowsServer\2025\AppBlockList\Audit
AppControl\WindowsServer\2025\DefaultPolicy\Enforce
AppControl\WindowsServer\2025\AppBlockList\Enforce
```

## Enable WDAC Audit mode

Inside the VM:

```powershell
Set-OSConfigDesiredConfiguration `
  -Scenario AppControl\WindowsServer\2025\DefaultPolicy\Audit `
  -Default

Set-OSConfigDesiredConfiguration `
  -Scenario AppControl\WindowsServer\2025\AppBlockList\Audit `
  -Default

Restart-Computer
```

After reconnecting:

```powershell
CiTool.exe -lp |
Select-String 'WS2025|Audit|AllowMicrosoft|BlockUMCI'
```

Observed policies included:

```text
BlockUMCI_Microsoft_WS2025_Audit
AllowMicrosoft_WS2025_Audit
```

`CiTool.exe -lp` may display `Press Enter to Continue`; press Enter or Ctrl+C after collecting the output.

### Audit-mode verification

```powershell
C:\UnsignedTest.exe
Start-Sleep 3

Get-WinEvent -FilterHashtable @{
    LogName   = 'Microsoft-Windows-CodeIntegrity/Operational'
    Id        = 3076
    StartTime = (Get-Date).AddMinutes(-5)
} |
Select-Object TimeCreated, Id, Message |
Format-List
```

Result:

- `UNSIGNED PROGRAM RAN` was printed.
- Code Integrity event `3076` identified `C:\UnsignedTest.exe`.
- The event stated that the file did not meet the signing requirements but was allowed because the policy was auditing.

Create the audit checkpoint on the host:

```powershell
Checkpoint-VM WDAC-Lab-Gen1 -SnapshotName 'WDAC-Audit-Working'
```

## Switch WDAC to Enforcement mode

Inside the VM:

```powershell
Remove-OSConfigDesiredConfiguration `
  -Scenario AppControl\WindowsServer\2025\DefaultPolicy\Audit

Remove-OSConfigDesiredConfiguration `
  -Scenario AppControl\WindowsServer\2025\AppBlockList\Audit

Set-OSConfigDesiredConfiguration `
  -Scenario AppControl\WindowsServer\2025\DefaultPolicy\Enforce `
  -Default

Set-OSConfigDesiredConfiguration `
  -Scenario AppControl\WindowsServer\2025\AppBlockList\Enforce `
  -Default

Restart-Computer
```

### Enforcement verification

```powershell
C:\UnsignedTest.exe
Start-Sleep 3

Get-WinEvent -FilterHashtable @{
    LogName   = 'Microsoft-Windows-CodeIntegrity/Operational'
    Id        = 3077
    StartTime = (Get-Date).AddMinutes(-5)
} |
Select-Object TimeCreated, Id, Message |
Format-List
```

Observed failure:

```text
Program 'UnsignedTest.exe' failed to run:
An Application Control policy has blocked this file
```

Event `3077` referenced:

```text
\Device\HarddiskVolume2\UnsignedTest.exe
```

This proved that the WDAC enforcement environment was functioning.

### Verify signed Microsoft executable remains allowed

```powershell
Get-AuthenticodeSignature C:\Windows\System32\whoami.exe |
Select-Object Status, SignerCertificate

C:\Windows\System32\whoami.exe
```

Expected and observed behavior:

- Signature status is `Valid`.
- `whoami.exe` executes.

## Azure Pipelines self-hosted agent

### Download and expand the agent package

One generic download method tested was:

```powershell
$release = Invoke-RestMethod `
  https://api.github.com/repos/microsoft/azure-pipelines-agent/releases/latest

$asset = $release.assets |
Where-Object name -Match '^(vsts|pipelines)-agent-win-x64-.*\.zip$' |
Select-Object -First 1

New-Item C:\azagent -ItemType Directory -Force
Invoke-WebRequest $asset.browser_download_url `
  -OutFile C:\azagent\agent.zip

Expand-Archive C:\azagent\agent.zip C:\azagent -Force
Set-Location C:\azagent
.\bin\Agent.Listener.exe --version
```

The agent actually used for pipeline execution was:

```text
C:\Users\Administrator\Downloads\vsts-agent-win-x64-5.277.0
Agent version 5.277.0
```

### Configure the agent

Create or select an Azure DevOps self-hosted pool, then configure from the extracted agent directory.

Interactive:

```powershell
Set-Location C:\Users\Administrator\Downloads\vsts-agent-win-x64-5.277.0
.\config.cmd
```

Typical unattended form:

```powershell
.\config.cmd `
  --unattended `
  --url https://dev.azure.com/<organization> `
  --auth pat `
  --token <PAT> `
  --pool <pool-name> `
  --agent WDAC-Lab-Gen1 `
  --work _work
```

Never store the PAT in source control or in this document.

Run interactively:

```powershell
.\run.cmd
```

The agent package itself ran successfully under WDAC Enforcement mode. That is expected: the agent must remain operational so a task can exercise a blocked dependency.

## General pipeline smoke test

The test pipeline used local-only task scenarios and did not require service connections:

```yaml
trigger: none
pr: none

pool:
  name: <self-hosted-pool>

steps:
- checkout: none

- task: PowerShell@2
  displayName: PowerShell V2
  inputs:
    targetType: inline
    script: |
      $root = "$(Build.ArtifactStagingDirectory)\signing-test"
      New-Item "$root\input" -ItemType Directory -Force
      Set-Content "$root\input\hello.txt" "Signed task test"

      Set-Content "$root\test.cmd" @'
      @echo off
      echo BatchScript V1 succeeded
      '@

      [IO.File]::WriteAllText(
        "$root\test.sh",
        "#!/usr/bin/env bash`necho 'ShellScript V2 succeeded'`n"
      )

      Set-Content "$root\gradlew.bat" @'
      @echo off
      echo Gradle V2 wrapper invoked with: %*
      exit /b 0
      '@

- task: Bash@3
  displayName: Bash V3
  inputs:
    targetType: inline
    script: echo "Bash V3 succeeded"

- task: CmdLine@2
  displayName: CmdLine V2
  inputs:
    script: echo CmdLine V2 succeeded

- task: BatchScript@1
  displayName: BatchScript V1
  inputs:
    filename: '$(Build.ArtifactStagingDirectory)\signing-test\test.cmd'

- task: ShellScript@2
  displayName: ShellScript V2
  inputs:
    scriptPath: '$(Build.ArtifactStagingDirectory)\signing-test\test.sh'

- task: CopyFiles@2
  displayName: CopyFiles V2
  inputs:
    SourceFolder: '$(Build.ArtifactStagingDirectory)\signing-test\input'
    Contents: '**'
    TargetFolder: '$(Build.ArtifactStagingDirectory)\signing-test\copied'

- task: ArchiveFiles@2
  displayName: ArchiveFiles V2
  inputs:
    rootFolderOrFile: '$(Build.ArtifactStagingDirectory)\signing-test\copied'
    includeRootFolder: false
    archiveType: zip
    archiveFile: '$(Build.ArtifactStagingDirectory)\signing-test\files.zip'
    replaceExistingArchive: true

- task: ExtractFiles@1
  displayName: ExtractFiles V1
  inputs:
    archiveFilePatterns: '$(Build.ArtifactStagingDirectory)\signing-test\files.zip'
    destinationFolder: '$(Build.ArtifactStagingDirectory)\signing-test\extracted'
    cleanDestinationFolder: true

- task: DeleteFiles@1
  displayName: DeleteFiles V1
  inputs:
    SourceFolder: '$(Build.ArtifactStagingDirectory)\signing-test\extracted'
    Contents: '**'

- task: Gradle@2
  displayName: Gradle V2 - deprecated
  inputs:
    wrapperScript: '$(Build.ArtifactStagingDirectory)\signing-test\gradlew.bat'
    tasks: build
    publishJUnitResults: false

- task: DotNetCoreInstaller@0
  displayName: DotNetCoreInstaller V0 - deprecated
  inputs:
    packageType: sdk
    version: '2.1.818'
```

## Why the smoke pipeline passed under enforcement

### PowerShellV2

The task:

- Used the PowerShell3 handler.
- Launched signed system `powershell.exe`.
- Generated a temporary inline `.ps1`.
- Interpreted that script through the allowed PowerShell host.

The existence of unsigned native files elsewhere in the task directory did not affect this code path.

### CmdLineV2

The task generated a temporary `.cmd` and ran it through signed system `cmd.exe`.

### Node-based tasks

The task JavaScript was interpreted by the agent-provided Node runtime:

```text
C:\Users\Administrator\Downloads\vsts-agent-win-x64-5.277.0\externals\node20_1\bin\node.exe
```

The signed/allowed Node host executed the task JavaScript. That does not prove that every optional native dependency in the task directory is signed.

### ArchiveFilesV2 and ExtractFilesV1

These tasks executed a bundled 7-Zip path successfully. That specific 7-Zip payload was trusted/signed in the downloaded task package.

### Core rule

WDAC did not recursively scan the task directory and reject it because another unused file was unsigned. It evaluated files that were executed or loaded on the active path.

## Scan the downloaded task cache

Agent task cache:

```text
C:\Users\Administrator\Downloads\vsts-agent-win-x64-5.277.0\_work\_tasks
```

### Basic native-file signature scan

```powershell
$root = 'C:\Users\Administrator\Downloads\vsts-agent-win-x64-5.277.0\_work\_tasks'

Get-ChildItem $root -Recurse -File |
Where-Object {
    $_.Extension -in '.exe', '.dll', '.node'
} |
ForEach-Object {
    try {
        $signature = Get-AuthenticodeSignature `
          -LiteralPath $_.FullName `
          -ErrorAction Stop

        if ($signature.Status -ne 'Valid') {
            [pscustomobject]@{
                Status = $signature.Status
                Path   = $_.FullName
            }
        }
    }
    catch {
        [pscustomobject]@{
            Status = 'ScanError'
            Path   = $_.FullName
            Error  = $_.Exception.Message
        }
    }
} |
Format-Table -AutoSize
```

Component Governance files changed/disappeared while one scan was running, producing `UnknownError` and file-not-found noise. A focused scan excluded that task:

```powershell
$root = 'C:\Users\Administrator\Downloads\vsts-agent-win-x64-5.277.0\_work\_tasks'

Get-ChildItem $root -Recurse -File |
Where-Object {
    $_.Extension -in '.exe', '.dll', '.node' -and
    $_.FullName -notmatch 'ComponentGovernanceComponentDetection'
} |
ForEach-Object {
    try {
        $signature = Get-AuthenticodeSignature `
          -LiteralPath $_.FullName `
          -ErrorAction Stop

        if ($signature.Status -ne 'Valid') {
            $relative = $_.FullName.Substring($root.Length + 1)

            [pscustomobject]@{
                Task   = $relative.Split('\')[0]
                Status = $signature.Status
                File   = $relative
            }
        }
    }
    catch {
    }
} |
Format-List
```

### Confirmed unsigned files in old downloaded tasks

#### BashV3

```text
node_modules\azure-pipelines-tasks-utility-common\tools\7zip24\7zip\7z.exe
node_modules\azure-pipelines-tasks-utility-common\tools\7zip25\7zip\7z.dll
node_modules\azure-pipelines-tasks-utility-common\tools\7zip25\7zip\7z.exe
node_modules\azure-pipelines-tool-lib\externals\7zip\7z.exe
```

#### CmdLineV2

```text
ps_modules\VstsTaskSdk\Minimatch.dll
```

#### DotNetCoreInstallerV0

```text
node_modules\azure-pipelines-tool-lib\externals\7zip\7z.exe
```

#### PowerShellV2

```text
node_modules\azure-pipelines-tasks-utility-common\tools\7zip24\7zip\7z.exe
node_modules\azure-pipelines-tasks-utility-common\tools\7zip25\7zip\7z.dll
node_modules\azure-pipelines-tasks-utility-common\tools\7zip25\7zip\7z.exe
node_modules\azure-pipelines-tool-lib\externals\7zip\7z.exe
ps_modules\VstsTaskSdk\Minimatch.dll
```

These results prove the old downloaded packages contain unsigned native payloads. They do not prove those payloads were loaded during a successful task run.

## Scan an extracted post-signing artifact

An extracted artifact was inspected at:

```text
C:\Users\dassayantan\Downloads\tasks (1)
```

It contained:

```text
ArchiveFilesV2
AzureFileCopyV1
AzureRmWebAppDeploymentV4
AzureVmssDeploymentV0
PowerShellV2
```

Observed valid native-file counts:

| Task | Native files with valid signatures |
|---|---:|
| ArchiveFilesV2 | 2 |
| AzureFileCopyV1 | 216 |
| AzureRmWebAppDeploymentV4 | 41 |
| AzureVmssDeploymentV0 | 28 |
| PowerShellV2 | 8 |

This appeared to be a post-signing artifact. The exact built/published package remains the correct source for release validation.

## DotNetCoreInstallerV0 cache-miss experiment

The first DotNetCoreInstaller run used SDK `2.1.818`, which was already in the agent tool cache. The task therefore did not perform extraction.

To force a cache miss, the task was run with:

```yaml
- task: DotNetCoreInstaller@0
  displayName: DotNetCoreInstaller
  inputs:
    packageType: sdk
    version: '2.1.505'
```

The logs confirmed:

```text
checking cache: ...\_work\_tool\dncs\2.1.505\x64
not found
Downloading ... dotnet-sdk-2.1.505-win-x64.zip
```

### Important correction

The prediction was that `azure-pipelines-tool-lib` would execute its bundled unsigned `7z.exe`.

The actual log showed:

```text
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
[System.IO.Compression.ZipFile]::ExtractToDirectory(...)
```

The ZIP was extracted by signed Microsoft PowerShell and the .NET `System.IO.Compression` assembly. The unsigned bundled `7z.exe` was never executed.

The task succeeded and cached SDK `2.1.505`.

This is strong evidence for the execution-time rule:

- An unsigned `7z.exe` was present.
- The task took a different extraction path.
- WDAC never evaluated that dormant `7z.exe`.
- The task succeeded.

## Minimatch.dll experiment

### First attempt and why it failed

The initial inline script attempted:

```powershell
$sdk = Get-Module VstsTaskSdk
$dll = Join-Path $sdk.ModuleBase 'Minimatch.dll'
```

It failed with:

```text
Join-Path: Cannot bind argument to parameter 'Path' because it is null.
```

This was not a WDAC failure.

PowerShellV2 loaded `VstsTaskSdk` in the task-handler PowerShell process, then launched the user's generated inline script in a separate child `powershell.exe`. The child process did not inherit the handler's loaded module, so `Get-Module VstsTaskSdk` returned null.

No attempt was made to load `Minimatch.dll` in that run.

### Correct deterministic DLL load test

Use a path search in the agent task cache:

```yaml
- task: PowerShell@2
  displayName: Load unsigned task DLL
  inputs:
    targetType: inline
    script: |
      $ErrorActionPreference = 'Stop'

      $dll = Get-ChildItem "$env:AGENT_WORKFOLDER\_tasks" `
        -Recurse -File -Filter Minimatch.dll |
        Where-Object FullName -Like '*\PowerShell_*\2.279.0\ps_modules\VstsTaskSdk\Minimatch.dll' |
        Select-Object -First 1

      if (-not $dll) {
          throw 'PowerShell task Minimatch.dll was not found.'
      }

      Get-AuthenticodeSignature $dll.FullName |
          Format-List Status, Path

      Write-Host "Loading $($dll.FullName)"
      [System.Reflection.Assembly]::LoadFrom($dll.FullName)
```

Expected verification:

1. `Get-AuthenticodeSignature` reports `NotSigned`.
2. The script explicitly attempts to load that DLL.
3. WDAC blocks the load if the policy applies to that managed assembly.
4. Code Integrity event `3077` references the exact `Minimatch.dll` path.

This corrected test was prepared after the first setup failure. Record the final pipeline result and event details when executed.

## Direct unsigned 7-Zip execution test

If a deterministic unmanaged executable test is required, explicitly locate and execute one of the confirmed unsigned copies:

```yaml
- task: PowerShell@2
  displayName: Execute unsigned task 7-Zip
  inputs:
    targetType: inline
    script: |
      $ErrorActionPreference = 'Stop'

      $sevenZip = Get-ChildItem "$env:AGENT_WORKFOLDER\_tasks" `
        -Recurse -File -Filter 7z.exe |
        Where-Object FullName -Like `
          '*\DotNetCoreInstaller_*\0.276.0\node_modules\azure-pipelines-tool-lib\externals\7zip\7z.exe' |
        Select-Object -First 1

      if (-not $sevenZip) {
          throw 'Unsigned DotNetCoreInstaller 7z.exe was not found.'
      }

      Get-AuthenticodeSignature $sevenZip.FullName |
          Format-List Status, Path

      & $sevenZip.FullName i
```

This proves WDAC blocks the packaged unsigned executable. It does not prove that DotNetCoreInstaller's normal runtime path uses that executable.

## Code Integrity event queries

### Audit events

```powershell
Get-WinEvent -FilterHashtable @{
    LogName   = 'Microsoft-Windows-CodeIntegrity/Operational'
    Id        = 3076
    StartTime = (Get-Date).AddHours(-1)
} |
Select-Object TimeCreated, Id, Message |
Format-List
```

### Enforcement events

```powershell
Get-WinEvent -FilterHashtable @{
    LogName   = 'Microsoft-Windows-CodeIntegrity/Operational'
    Id        = 3077
    StartTime = (Get-Date).AddHours(-1)
} |
Select-Object TimeCreated, Id, Message |
Format-List
```

### Filter for the Azure Pipelines agent work directory

```powershell
Get-WinEvent -FilterHashtable @{
    LogName   = 'Microsoft-Windows-CodeIntegrity/Operational'
    Id        = 3076, 3077
    StartTime = (Get-Date).AddHours(-1)
} |
Where-Object Message -Like '*\_work\_*' |
Select-Object TimeCreated, Id, Message |
Format-List
```

Event meanings:

| Event | Meaning |
|---|---|
| 3076 | The policy would block the file, but Audit mode allowed it |
| 3077 | Enforcement mode blocked the file |

## Why signing every signable file is still requested

For WDAC alone, a file that is provably never executed or loaded does not technically need signing.

The feature asks to sign all signable task content because the release artifact must work across more than one smoke-test path:

- Different task inputs activate different code.
- Different operating systems use different handlers and tools.
- Download, extraction, fallback, retry, and error paths may load optional dependencies.
- Native libraries can be loaded dynamically, making static call-path analysis incomplete.
- Dependencies can change behavior in later versions.
- Compliance may require every shipped executable to have publisher provenance.
- A simple static acceptance rule, "no unsigned executable content," is safer and easier to validate than maintaining exceptions for supposedly dormant files.

Therefore:

- "One unsigned file anywhere causes WDAC to reject the whole task directory" is not accurate for Windows Code Integrity by itself.
- "Any unsigned executable shipped in a task is a latent task failure if some supported path loads it" is accurate.
- A separate package scanner or release gate could reject a package merely for containing an unsigned native file, but that would be distinct from WDAC runtime enforcement.

## What "every file" should mean

Not every task file can or should receive an Authenticode signature.

Relevant signable or executable content includes:

```text
.exe
.dll
.node
.ps1
.psm1
other applicable executable scripts or native formats
```

Files such as JSON, ordinary JavaScript source, documentation, localization data, and configuration files are not all Authenticode-signable in the same manner.

The practical acceptance criterion should be explicit, for example:

> Every Windows-executable or loadable file shipped in the final task package must either have an approved valid signature or be covered by a documented exception and verified not to be executable under supported task scenarios.

A stricter compliance criterion can simply disallow unsigned native content without exceptions.

## Recommended signed-release validation

For each selected task:

1. Bump the task version according to repository sprint/version rules.
2. Build through the release-equivalent `serverBuild` path.
3. Enable task file signing.
4. Decide explicitly whether native `node_modules` content must be included.
5. Produce the individual task ZIP.
6. Verify the task ZIP's NuGet signature.
7. Extract the task ZIP.
8. Recursively scan `.exe`, `.dll`, and `.node`.
9. Treat `NotSigned`, `HashMismatch`, `NotTrusted`, `UnknownError`, and scan failures as failures requiring investigation.
10. Run the task in WDAC Audit mode and inspect events 3076/3077.
11. Run in WDAC Enforcement mode.
12. Exercise important normal, fallback, and error paths rather than only a basic happy path.
13. Confirm that no task-related Code Integrity blocks occur.

### Suggested extracted-package scan

```powershell
param(
    [Parameter(Mandatory)]
    [string]$TaskRoot
)

$results = Get-ChildItem $TaskRoot -Recurse -File |
Where-Object Extension -In '.exe', '.dll', '.node' |
ForEach-Object {
    try {
        $signature = Get-AuthenticodeSignature `
          -LiteralPath $_.FullName `
          -ErrorAction Stop

        [pscustomobject]@{
            Status = $signature.Status
            Path   = $_.FullName
            Signer = $signature.SignerCertificate.Subject
        }
    }
    catch {
        [pscustomobject]@{
            Status = 'ScanError'
            Path   = $_.FullName
            Signer = $_.Exception.Message
        }
    }
}

$results |
Sort-Object Status, Path |
Format-Table -AutoSize

$failures = $results |
Where-Object Status -ne 'Valid'

if ($failures) {
    throw "$($failures.Count) native files do not have a valid Authenticode signature."
}
```

## Build commands for future signed samples

From the repository root:

```powershell
node make.js build --task PowerShellV2
node make.js test --task PowerShellV2 --suite L0
```

Release-equivalent build for one task:

```powershell
node make.js serverBuild --task PowerShellV2
```

Repeat for the selected task set as required.

Built task contents are placed under:

```text
_build\Tasks\<TaskName>
```

Do not make signing conclusions by scanning only:

```text
Tasks\<TaskName>
```

because the build can add:

- `node_modules`
- common task packages
- PowerShell modules
- external executables
- downloaded tools
- generated localization and metadata

## Logs and artifacts used

| Path | Description |
|---|---|
| `C:\Users\dassayantan\Downloads\logs_2528` | Successful basic CmdLine and PowerShell pipeline |
| `C:\Users\dassayantan\Downloads\logs_2538` | Multi-task smoke pipeline; ArchiveFiles and ExtractFiles invoked trusted bundled 7-Zip |
| `C:\Users\dassayantan\Downloads\tasks (1)` | Extracted task packages believed to be post-signing |
| `C:\Users\dassayantan\.copilot\session-state\5e336e25-aaad-453d-809d-cf81dbd0b4f2\files\task-signing-sample.md` | Selected sample task table |
| `C:\Users\dassayantan\.copilot\session-state\5e336e25-aaad-453d-809d-cf81dbd0b4f2\files\task-signing-test.yml` | Smoke-test pipeline YAML |
| `C:\Users\dassayantan\.copilot\session-state\5e336e25-aaad-453d-809d-cf81dbd0b4f2\files\paste-1787215552433.txt` | Native signature scan output |

## Recovery and cleanup

If enforcement prevents required testing, revert the VM from the host:

```powershell
Get-VMSnapshot -VMName WDAC-Lab-Gen1
Restore-VMSnapshot `
  -VMName WDAC-Lab-Gen1 `
  -Name 'WDAC-Audit-Working' `
  -Confirm:$false
```

Start and reconnect:

```powershell
Start-VM WDAC-Lab-Gen1
vmconnect.exe localhost WDAC-Lab-Gen1
```

Do not apply or remove corporate App Control policies on the host Cloud PC.

## Current status

Completed:

- Signing pipeline flow traced.
- Task counts and sample set identified.
- Disposable Windows Server 2025 VM created.
- WDAC Audit event 3076 reproduced.
- WDAC Enforcement event 3077 reproduced.
- Signed Microsoft executable allowed.
- Azure Pipelines agent 5.277.0 ran under enforcement.
- Multiple Azure Pipelines tasks ran successfully.
- Old downloaded tasks were proven to contain unsigned native files.
- DotNetCoreInstaller cache-miss behavior was captured and corrected: it used PowerShell/.NET ZIP extraction rather than bundled 7-Zip.
- The first Minimatch test failure was explained as process/module isolation, not WDAC.

Still to complete:

- Run the corrected explicit `Minimatch.dll` load test and capture event 3077.
- Run the direct unsigned task-bundled `7z.exe` test if an unmanaged negative control is needed.
- Build and publish the newly signed task versions.
- Scan every final extracted task package.
- Rerun the same scenarios under enforcement and compare Code Integrity events.
