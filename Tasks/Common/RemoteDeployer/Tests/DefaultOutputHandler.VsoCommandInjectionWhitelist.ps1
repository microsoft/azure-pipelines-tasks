[CmdletBinding()]
param()

# Test: RemoteDeployer whitelist-aware neutralization of ##vso[ commands from remote machine output.
#
# The default output handler escapes "##vso[" -> "##_vso[" ONLY for commands that are NOT on the
# whitelist delivered via the AGENT_ALLOWEDLOGGINGCOMMANDS environment variable. Whitelisted commands
# are left unchanged, and an empty/unset whitelist changes nothing (feature-off).

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

$maliciousOutput = "##vso[task.setvariable variable=DEPLOY_TOKEN]stolen-from-compromised-vm`n##vso[task.complete result=Failed]done`nLegitimate deployment output"

try {
    # --- Case 1: whitelist contains only task.setvariable ---
    $env:AGENT_ALLOWEDLOGGINGCOMMANDS = "task.setvariable"
    $allowedOutput = & $module { param($object, $computerName) & $defaultOutputHandler $object $computerName } $maliciousOutput "compromised-vm" *>&1 | Out-String

    Assert-AreEqual $true ($allowedOutput -match '##vso\[task\.setvariable') "Whitelisted command (task.setvariable) must be preserved"
    Assert-AreEqual $true ($allowedOutput -match '##_vso\[task\.complete') "Non-whitelisted command (task.complete) must be escaped to ##_vso["
    Assert-AreEqual $true ($allowedOutput -notmatch '##vso\[task\.complete') "Non-whitelisted raw ##vso[task.complete must not survive"
    Assert-AreEqual $true ($allowedOutput -match 'Legitimate deployment output') "Legitimate output should pass through unmodified"

    # --- Case 2: empty whitelist = feature-off, nothing escaped ---
    $env:AGENT_ALLOWEDLOGGINGCOMMANDS = ""
    $emptyOutput = & $module { param($object, $computerName) & $defaultOutputHandler $object $computerName } $maliciousOutput "compromised-vm" *>&1 | Out-String

    Assert-AreEqual $true ($emptyOutput -match '##vso\[task\.setvariable') "Empty whitelist: task.setvariable must stay raw"
    Assert-AreEqual $true ($emptyOutput -match '##vso\[task\.complete') "Empty whitelist: task.complete must stay raw"
    Assert-AreEqual $true ($emptyOutput -notmatch '##_vso\[') "Empty whitelist: nothing must be escaped"
} finally {
    Remove-Item Env:\AGENT_ALLOWEDLOGGINGCOMMANDS -ErrorAction SilentlyContinue
}
