[CmdletBinding()]
param()

# Test: RemoteDeployer DRY-RUN of the ##vso[ command-injection fix.
#
# The default output/error handlers must NOT sanitize ##vso[ commands from remote machine output
# (so customers who intentionally use ##vso[ commands on remote machines keep working). Instead they
# must publish telemetry describing which ##vso[ commands would have been blocked.

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

$maliciousOutput = "##vso[task.setvariable variable=DEPLOY_TOKEN]stolen-from-compromised-vm`n##vso[task.setvariable variable=VM_COMPROMISED]true`nLegitimate deployment output`nMixed ##vso[task.complete result=Failed] mid-line"

# Invoke the production $defaultOutputHandler inside the module scope and capture ALL output streams
# (the remote output and the dry-run telemetry are written via Write-Host / the information stream).
$allOutput = & $module { param($object, $computerName) & $defaultOutputHandler $object $computerName } $maliciousOutput "compromised-vm" *>&1 | Out-String

# Dry-run must NOT sanitize: raw ##vso[ passes through unchanged.
Assert-AreEqual $true ($allOutput -match '##vso\[task\.setvariable') "Dry-run must NOT modify remote output - raw ##vso[task.setvariable] should still be present"
Assert-AreEqual $true ($allOutput -notmatch '##_vso\[') "Dry-run must not escape ##vso[ to ##_vso["

# Dry-run telemetry is published for the detected commands.
Assert-AreEqual $true ($allOutput -match 'telemetry\.publish area=TaskHub;feature=RemoteVsoCommandInjectionDryRun') "Dry-run telemetry must be published when ##vso[ commands are detected in remote output"
Assert-AreEqual $true ($allOutput -match 'task\.setvariable') "Dry-run telemetry payload should reference the detected command name"

# Legitimate output passes through unmodified.
Assert-AreEqual $true ($allOutput -match 'Legitimate deployment output') "Legitimate output should pass through unmodified"

# When there are no ##vso[ commands, no dry-run telemetry should be emitted.
$cleanOutput = & $module { param($object, $computerName) & $defaultOutputHandler $object $computerName } "just a normal line of output" "clean-vm" *>&1 | Out-String
Assert-AreEqual $true ($cleanOutput -notmatch 'RemoteVsoCommandInjectionDryRun') "No dry-run telemetry should be published when there are no ##vso[ commands"
