[CmdletBinding()]
param()

# Test: PowerShellOnTargetMachinesV1 PowerShellJob must escape ##vso[ commands from remote output.
#
# The vulnerability: The job scriptblock calls Invoke-PsOnRemote via Invoke-Command.
# A compromised VM returns ##vso[ commands via Write-Host in the remote session.
# These flow through the information stream (stream 6) back to the job.
# The fix wraps Invoke-Command with 6>&1 filtering to escape ##vso[ lines.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

# Source the PowerShellJob.ps1 to get $RunPowershellJob scriptblock
. $PSScriptRoot\..\PowerShellJob.ps1

# Mock Invoke-PsOnRemote (normally from DLL) to simulate a compromised VM
# that injects ##vso commands via its script output
function global:Invoke-PsOnRemote {
    param([string]$MachineDnsName, [string]$ScriptPath, [string]$WinRMPort, $Credential, 
          [string]$ScriptArguments, [string]$InitializationScriptPath, $SessionVariables)
    # Simulate compromised VM writing ##vso commands
    Write-Host "##vso[task.setvariable variable=injectedSecret;issecret=true]stolen-value"
    Write-Host "##vso[task.setvariable variable=Build.Repository.Clean]true"
    Write-Host "Legitimate script output from VM"
    return @{ Status = "Passed"; DeploymentLog = "Success"; Error = $null }
}

function global:Get-ParsedSessionVariables { param($inputSessionVariables) return @{} }

# Execute the job scriptblock directly (not via Start-Job) and capture all output
$allOutput = & {
    & $RunPowershellJob "test-vm" $validScriptPath "5986" "" "" $null "-UseHttp" "" "false" ""
} *>&1

# Verify: NO ##vso[task.setvariable] commands should appear in the output
$vsoCommandsFound = @()
foreach ($line in $allOutput) {
    $lineStr = ($line | Out-String).Trim()
    if ($lineStr -match '##vso\[task\.setvariable') {
        $vsoCommandsFound += $lineStr
    }
}

Assert-AreEqual 0 $vsoCommandsFound.Count "##vso[task.setvariable] commands from remote VM must be escaped by PowerShellJob. Found $($vsoCommandsFound.Count): $($vsoCommandsFound -join '; ')"

# Also verify that legitimate output still passes through
$hasLegitOutput = $false
foreach ($line in $allOutput) {
    $lineStr = ($line | Out-String).Trim()
    if ($lineStr -match 'Legitimate script output') {
        $hasLegitOutput = $true
        break
    }
}

Assert-AreEqual $true $hasLegitOutput "Legitimate script output should still pass through"

# Verify escaped output is visible as ##_vso[
$hasEscaped = $false
foreach ($line in $allOutput) {
    $lineStr = ($line | Out-String).Trim()
    if ($lineStr -match '##_vso\[') {
        $hasEscaped = $true
        break
    }
}

Assert-AreEqual $true $hasEscaped "Escaped ##vso[ commands should appear as ##_vso[ for diagnostic visibility"

