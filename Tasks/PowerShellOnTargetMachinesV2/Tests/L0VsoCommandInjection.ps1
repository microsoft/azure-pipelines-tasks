[CmdletBinding()]
param()

# Test: PowerShellOnTargetMachinesV2 PowerShellJob must strip ##vso[ commands from remote output.
#
# The vulnerability: The job scriptblock calls Invoke-PsOnRemote via Invoke-Command.
# A compromised VM returns ##vso[ commands via Write-Host in the remote session.
# These flow through the information stream (stream 6) back to the job.
# The fix wraps Invoke-Command with 6>&1 filtering to strip ##vso[ lines.
#
# EXPECTED: This test FAILS until the vulnerability is fixed in PowerShellJob.ps1.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

# Source the PowerShellJob.ps1 to get $RunPowershellJob scriptblock
. $PSScriptRoot\..\PowerShellJob.ps1

# Mock Invoke-PsOnRemote (normally from DLL) to simulate a compromised VM
function global:Invoke-PsOnRemote {
    param([string]$MachineDnsName, [string]$ScriptPath, [string]$WinRMPort, $Credential, 
          [string]$ScriptArguments, [string]$InitializationScriptPath, $SessionVariables)
    Write-Host "##vso[task.setvariable variable=secretVar;issecret=true]stolen-credentials"
    Write-Host "##vso[task.setvariable variable=system.accesstoken]pwned"
    Write-Host "Legitimate deployment output"
    return @{ Status = "Passed"; DeploymentLog = "Success"; Error = $null }
}

function global:Get-ParsedSessionVariables { param($inputSessionVariables) return @{} }

# Execute the job scriptblock directly and capture all output
$allOutput = & {
    & $RunPowershellJob "test-vm" $validScriptPath "5986" "" "" $null "-UseHttp" "" "false" "" "$PSScriptRoot\.."
} *>&1

# Verify: NO ##vso[task.setvariable] commands should appear in the output
$vsoCommandsFound = @()
foreach ($line in $allOutput) {
    $lineStr = ($line | Out-String).Trim()
    if ($lineStr -match '##vso\[task\.setvariable') {
        $vsoCommandsFound += $lineStr
    }
}

Assert-AreEqual 0 $vsoCommandsFound.Count "##vso[task.setvariable] commands from remote VM must be stripped by PowerShellJob. Found $($vsoCommandsFound.Count): $($vsoCommandsFound -join '; ')"

# Verify legitimate output passes through
$hasLegitOutput = $false
foreach ($line in $allOutput) {
    $lineStr = ($line | Out-String).Trim()
    if ($lineStr -match 'Legitimate deployment output') {
        $hasLegitOutput = $true
        break
    }
}

Assert-AreEqual $true $hasLegitOutput "Legitimate output should still pass through"
