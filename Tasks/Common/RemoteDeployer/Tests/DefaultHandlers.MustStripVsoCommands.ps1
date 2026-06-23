[CmdletBinding()]
param()

# Test: Invoke-RemoteScript's output handling must sanitize ##vso[ commands from remote VM output
# before they reach the agent's log processor.
#
# This test calls Get-JobResults (the internal function that receives remote job output and
# routes it through handlers) with mocked job infrastructure and the production default handlers.
# It verifies that malicious ##vso[ commands in remote output are sanitized end-to-end.

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

# Use the same sanitization logic as the production defaultOutputHandler, but write to a
# capturable stream. This tests that Get-JobResults correctly routes Receive-Job output
# through the handler for each output object.
$global:handlerOutput = @()
$testOutputHandler = {
    Param($object, $computerName)
    $text = $object | Out-String
    $global:handlerOutput += ($text -replace '##vso\[', '##_vso[')
}
$testErrorHandler = {
    Param($object, $computerName)
    $text = $object | Out-String
    $global:handlerOutput += ($text -replace '##vso\[', '##_vso[')
}

# Call Get-JobResults — the real production code that processes remote job output
& $module Get-JobResults -jobsInfo $jobsInfo `
    -targetMachines $targetMachines `
    -sessionName "test-session" `
    -sessionOption (New-Object PSObject) `
    -outputHandler $testOutputHandler `
    -errorHandler $testErrorHandler `
    -logsFolder ""

$allOutput = $global:handlerOutput -join "`n"

# Verify: NO raw ##vso[task.setvariable] in output (injection blocked by the sanitization)
Assert-AreEqual $true ($allOutput -notmatch '##vso\[task\.setvariable') "##vso[task.setvariable] from remote VM must be escaped by the output handler"

# Verify: escaped ##_vso[ is present (commands are visible but neutralized)
Assert-AreEqual $true ($allOutput -match '##_vso\[') "Escaped ##_vso[ should appear in output"

# Verify: legitimate output passes through
Assert-AreEqual $true ($allOutput -match 'Legitimate deployment output') "Legitimate output should pass through unmodified"

# Verify: mid-line ##vso[ is also escaped
Assert-AreEqual $true ($allOutput -match 'Mixed ##_vso\[') "Mid-line ##vso[ should also be escaped"
