[CmdletBinding()]
param()

# Test: Invoke-RemoteScript's output handling must sanitize ##vso[ commands from remote VM output
# before they reach the agent's log processor.
#
# This test calls Get-JobResults (the internal function that receives remote job output and
# routes it through the production default handlers) with mocked job infrastructure.
# It verifies that malicious ##vso[ commands in remote output are sanitized end-to-end
# by the actual production defaultOutputHandler.

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

# Mock Get-Job to return a "Completed" job with proper Location
Register-Mock Get-Job { return @{ State = "Completed"; Location = "compromised-vm" } }

# Mock Receive-Job to simulate malicious remote output containing ##vso injection attempts.
# In production, this is where output from the remote script execution arrives.
Register-Mock Receive-Job {
    Write-Output "##vso[task.setvariable variable=DEPLOY_TOKEN]stolen-from-compromised-vm"
    Write-Output "##vso[task.setvariable variable=VM_COMPROMISED]true"
    Write-Output "Legitimate deployment output"
    Write-Output "Mixed ##vso[task.complete result=Failed] mid-line"
}

# Setup job info simulating a single completed remote job
$jobsInfo = @(
    [pscustomobject]@{ Id = 1; Location = "compromised-vm"; JobRetrievelCount = 0 }
)
$targetMachines = @(
    @{ ComputerName = "compromised-vm"; WSManPort = "5985" }
)

# Get the PRODUCTION default handlers from the module
$outputHandler = & $module { $defaultOutputHandler }
$errorHandler = & $module { $defaultErrorHandler }

# Call Get-JobResults with production handlers. Capture only stream 6 (Write-Host/Information)
# which is where the defaultOutputHandler writes sanitized output. Other streams (verbose, etc.)
# contain mock framework diagnostic messages that would contaminate the assertion.
$allOutput = (& $module Get-JobResults -jobsInfo $jobsInfo `
    -targetMachines $targetMachines `
    -sessionName "test-session" `
    -sessionOption (New-Object PSObject) `
    -outputHandler $outputHandler `
    -errorHandler $errorHandler `
    -logsFolder "") 6>&1 | Out-String

# Verify: NO raw ##vso[task.setvariable] in output (injection blocked by production handler)
Assert-AreEqual $true ($allOutput -notmatch '##vso\[task\.setvariable') "##vso[task.setvariable] from remote VM must be escaped by the production defaultOutputHandler"

# Verify: escaped ##_vso[ is present (commands are visible but neutralized)
Assert-AreEqual $true ($allOutput -match '##_vso\[') "Escaped ##_vso[ should appear in output"

# Verify: legitimate output passes through
Assert-AreEqual $true ($allOutput -match 'Legitimate deployment output') "Legitimate output should pass through unmodified"
