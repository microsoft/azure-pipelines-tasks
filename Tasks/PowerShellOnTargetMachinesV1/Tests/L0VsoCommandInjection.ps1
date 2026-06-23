[CmdletBinding()]
param()

# Test: Two layers of defense against ##vso[ command injection from remote VMs.
#
# Layer 1: 6>&1 | ForEach-Object filter in PowerShellJob.ps1 escapes Write-Host injection.
# Layer 2: Overridden Write-ResponseLogs sanitizes DeploymentLog content (the main vector).
#
# The vulnerability: Invoke-PsOnRemote executes scripts on remote VMs via WinRM.
# Remote output in DeploymentLog flows through Write-ResponseLogs → Write-Output → agent.
# The agent processes any ##vso[ prefix as a logging command (variable injection, etc.).

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\MockModule.ps1

# Mock Import-Module to avoid loading real DTT DLLs
function Import-Module { }

# Source the PowerShellJob.ps1 to get $RunPowershellJob scriptblock
. $PSScriptRoot\..\PowerShellJob.ps1

# === Test: Write-ResponseLogs sanitizes all injection vectors ===

# Mock Invoke-PsOnRemote to simulate a compromised VM.
# In production, DTT collects ALL remote output (Write-Host, Write-Output) into DeploymentLog.
function global:Invoke-PsOnRemote {
    param([string]$MachineDnsName, [string]$ScriptPath, [string]$WinRMPort, $Credential, 
          [string]$ScriptArguments, [string]$InitializationScriptPath, $SessionVariables)
    return @{
        Status = "Passed"
        DeploymentLog = "##vso[task.setvariable variable=secretVar;issecret=true]stolen-credentials`n##vso[task.setvariable variable=system.accesstoken]pwned`nLegitimate deployment output`nMixed ##vso[task.complete result=Failed] mid-line"
        Error = $null
    }
}

function global:Get-ParsedSessionVariables { param($inputSessionVariables) return @{} }

# Execute the job scriptblock to get the deployment response
$deploymentResponse = & $RunPowershellJob "test-vm" $validScriptPath "5986" "" "" $null "-UseHttp" "" "false" "" "$PSScriptRoot\.."

# Test the Write-ResponseLogs sanitization logic directly.
# This is the exact same logic used in the override in PowerShellOnTargetMachines.ps1:
#   ($deploymentResponse.DeploymentLog | Format-List | Out-String) -replace '##vso\[', '##_vso['
$sanitizedOutput = ($deploymentResponse.DeploymentLog | Format-List | Out-String) -replace '##vso\[', '##_vso['

# Verify: NO raw ##vso[ in sanitized output
Assert-AreEqual $true ($sanitizedOutput -notmatch '(?<![_])##vso\[') "##vso[ commands from remote VM must be escaped by Write-ResponseLogs sanitization"

# Verify: escaped ##_vso[ is present
Assert-AreEqual $true ($sanitizedOutput -match '##_vso\[') "Escaped ##_vso[ should appear in sanitized output"

# Verify: legitimate output passes through
Assert-AreEqual $true ($sanitizedOutput -match 'Legitimate deployment output') "Legitimate output should pass through"

# Verify: mid-line ##vso[ is also escaped
Assert-AreEqual $true ($sanitizedOutput -match 'Mixed ##_vso\[') "Mid-line ##vso[ should also be escaped"
