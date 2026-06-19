[CmdletBinding()]
param()

# Test: defaultOutputHandler must strip ##vso[ logging commands from remote output.
# This test verifies that the RemoteDeployer output handler does NOT pass ##vso[
# commands through to the agent stdout, which would allow a compromised remote VM
# to inject arbitrary pipeline commands (set variables, upload artifacts, etc.).
#
# EXPECTED: This test FAILS until the vulnerability is fixed, because the current
# $defaultOutputHandler simply does Write-Host ($object | Out-String) without any
# sanitization of ##vso[ prefixed lines.

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

# Get the default output handler scriptblock from the module scope
$outputHandler = & $module { $defaultOutputHandler }
$errorHandler = & $module { $defaultErrorHandler }

# --- Test 1: outputHandler must NOT emit ##vso[ lines to stdout ---
# Simulate malicious remote output containing ##vso commands
$maliciousOutput = "##vso[task.setvariable variable=secretToken;issecret=true]stolen-value"

# Capture what the output handler writes to stdout
$captured = & {
    & $outputHandler $maliciousOutput "compromised-vm"
} 6>&1 4>&1 *>&1

# The captured output must NOT contain the ##vso[ command
$containsVso = $false
foreach ($line in $captured) {
    $lineStr = ($line | Out-String).Trim()
    if ($lineStr -match '##vso\[') {
        $containsVso = $true
        break
    }
}

Assert-AreEqual $false $containsVso "defaultOutputHandler must strip ##vso[ commands from remote output but it passed them through unsanitized"

# --- Test 2: errorHandler must NOT emit ##vso[ lines to stdout ---
$maliciousError = "##vso[task.setvariable variable=agent_token;issecret=true]pwned"

$captured = & {
    & $errorHandler $maliciousError "compromised-vm"
} 6>&1 4>&1 *>&1

$containsVso = $false
foreach ($line in $captured) {
    $lineStr = ($line | Out-String).Trim()
    if ($lineStr -match '##vso\[') {
        $containsVso = $true
        break
    }
}

Assert-AreEqual $false $containsVso "defaultErrorHandler must strip ##vso[ commands from remote output but it passed them through unsanitized"

# --- Test 3: Normal output must still pass through ---
$normalOutput = "File copied successfully to C:\deploy\app.dll"

$captured = & {
    & $outputHandler $normalOutput "vm1"
} 6>&1 4>&1 *>&1

$capturedStr = ($captured | Out-String).Trim()
Assert-AreEqual $true ($capturedStr -like "*File copied successfully*") "Normal output should still be emitted by outputHandler"
