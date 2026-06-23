[CmdletBinding()]
param()

# Test: Invoke-RemoteScript must sanitize ##vso[ commands from remote VM output
# before they reach the agent's log processor.
#
# This test calls Invoke-RemoteScript (the public entry point) end-to-end with mocked
# infrastructure (sessions, jobs, network). It verifies that malicious ##vso[ commands
# in remote output are sanitized by the production defaultOutputHandler.

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

# --- Mock infrastructure so Invoke-RemoteScript can run without real WinRM connections ---

# Get-TargetMachines: return a single target machine descriptor
Register-Mock Get-TargetMachines {
    return @(
        @{ ComputerName = "compromised-vm"; WSManPort = "5985"; Credential = $null; Authentication = "Default"; sessionConfigurationName = "microsoft.powershell"; UseSsl = $false }
    )
}

# Get-WinRmConnectionToTargetMachine: return $null (passes [PSSession[]] type constraint)
Register-Mock Get-WinRmConnectionToTargetMachine { return $null }

# Get-VstsTaskVariable: return a fake job name
Register-Mock Get-VstsTaskVariable { return "fake-job-id" }

# Invoke-Command: return a mock parent job object with ChildJobs
Register-Mock Invoke-Command {
    $childJob = [pscustomobject]@{ Id = 1; Location = "compromised-vm" }
    return [pscustomobject]@{ ChildJobs = @($childJob) }
}

# Get-Job: return a "Completed" job with proper Location
Register-Mock Get-Job { return @{ State = "Completed"; Location = "compromised-vm" } }

# Receive-Job: simulate malicious remote output containing ##vso injection attempts.
# In production, this is where output from the remote script execution arrives.
Register-Mock Receive-Job {
    Write-Output "##vso[task.setvariable variable=DEPLOY_TOKEN]stolen-from-compromised-vm"
    Write-Output "##vso[task.setvariable variable=VM_COMPROMISED]true"
    Write-Output "Legitimate deployment output"
    Write-Output "Mixed ##vso[task.complete result=Failed] mid-line"
}

# Disconnect-WinRmConnectionToTargetMachines: no-op
Register-Mock Disconnect-WinRmConnectionToTargetMachines {}

# Set-TaskResult: no-op
Register-Mock Set-TaskResult {}

# Publish-Telemetry: no-op
Register-Mock Publish-Telemetry {}

# --- Call Invoke-RemoteScript (the production entry point) ---
# Capture stream 6 (Write-Host/Information) which is where the defaultOutputHandler writes
# sanitized output. Other streams (verbose, etc.) contain mock framework noise.
$allOutput = (& $module Invoke-RemoteScript `
    -targetMachineNames @("compromised-vm:5985") `
    -remoteScriptJobArgumentsByName @{ inline = $true; inlineScript = "whoami" } `
    -sessionOption (New-Object PSObject)) 6>&1 | Out-String

# Verify: NO raw ##vso[task.setvariable] in output (injection blocked by production handler)
Assert-AreEqual $true ($allOutput -notmatch '##vso\[task\.setvariable') "##vso[task.setvariable] from remote VM must be escaped by the production defaultOutputHandler"

# Verify: escaped ##_vso[ is present (commands are visible but neutralized)
Assert-AreEqual $true ($allOutput -match '##_vso\[') "Escaped ##_vso[ should appear in output"

# Verify: legitimate output passes through
Assert-AreEqual $true ($allOutput -match 'Legitimate deployment output') "Legitimate output should pass through unmodified"
