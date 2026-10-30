[CmdletBinding()]
param()

# Regression test that drives the REAL remote runner, Tasks/Common/RemoteDeployer/RunPowerShellScriptJob.ps1,
# the way it runs on the target VM. The other tests in this folder emulate that runner in-process with
# Invoke-Expression. The real one does more: it splices the generated scriptArguments into a script,
# writes that script to a temporary file (UTF-8 with a BOM) and starts a fresh powershell.exe to run it.
# This test covers that hop, including how the quote characters survive the temporary file.
#
# scriptArguments is built by the real Copy-FilesToAzureVMsFromStorageContainer, with both hardening flags
# on. A stand-in is used for the remote job itself (the real one would look for, or download, azcopy);
# it only reports what it received. Values are reported as base64 so the comparison does not depend on
# the console code page of the machine that runs the test. For every scenario the test checks that:
#   1) nothing injected through TargetPath or AdditionalArguments runs (a marker line would appear);
#   2) the original value reaches the remote job unchanged;
#   3) -useSourcePathHardening is still a real parameter, i.e. a quote in the value did not comment
#      out the switches that the generated text appends after it.
#
# The runner's telemetry lookups (WMI and the Azure instance metadata service) are mocked. They are
# unrelated to what is verified here and would only slow the test down.
#
# The typographic quote is built from its code point on purpose: the repository files are BOM-less,
# and Windows PowerShell 5.1 would read a literal non-ASCII character using the ANSI code page.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\..\AzureFileCopyRemoteJob.ps1
. $PSScriptRoot\..\..\Common\RemoteDeployer\RunPowerShellScriptJob.ps1
. $PSScriptRoot\MockHelper.ps1

$azureVMsProperties = Get-AzureVMResourcesProperties -resourceGroupName $validRG -resourceFilteringMethod 'tags'
$azureVMCredntials = Get-AzureVMsCredentials -vmsAdminUserName $validInputVmsAdminUserName -vmsAdminPassword $validInputVmsAdminPassword

Register-Mock Get-ChildItem { }
Register-Mock ConvertTo-SecureString { return $securedMockPassword }
Register-Mock Get-WmiObject { }
Register-Mock Invoke-RestMethod { }

# Capture the real remote job arguments instead of sending them to a VM.
Register-Mock Copy-FilesSequentiallyToAzureVMs { $global:capturedRemoteScriptJobArgs = $args }
Register-Mock Copy-FilesParallellyToAzureVMs { }

$invokeRemoteScriptParams = Get-InvokeRemoteScriptParameters -azureVMResourcesProperties $azureVMsProperties -networkCredentials $azureVMCredntials

# Stand-in for the remote job: same parameters, reports what it received.
$standInRemoteJob = @'
param(
    [string]$containerURL,
    [string]$targetPath,
    [string]$additionalArguments,
    [switch]$CleanTargetBeforeCopy,
    [switch]$EnableDetailedLogging,
    [switch]$useSanitizerActivate,
    [switch]$useSourcePathHardening
)
function ConvertTo-Base64([string]$s) { [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($s)) }
Write-Output ("RECEIVED targetPath=" + (ConvertTo-Base64 $targetPath))
Write-Output ("RECEIVED additionalArguments=" + (ConvertTo-Base64 $additionalArguments))
Write-Output ("RECEIVED hardeningSwitch=" + $useSourcePathHardening.IsPresent)
'@

function Get-GeneratedScriptArguments
{
    param(
        [string]$TargetPath,
        [string]$AdditionalArguments
    )

    $global:capturedRemoteScriptJobArgs = $null

    Copy-FilesToAzureVMsFromStorageContainer -targetMachineNames $invokeRemoteScriptParams.targetMachineNames -credential $invokeRemoteScriptParams.credential `
                                             -protocol $invokeRemoteScriptParams.protocol `
                                             -sessionOption $invokeRemoteScriptParams.sessionOption `
                                             -blobStorageEndpoint $validBlobStorageEndpoint `
                                             -containerName $validInputContainerName `
                                             -targetPath $TargetPath `
                                             -cleanTargetBeforeCopy $false `
                                             -copyFilesInParallel $false `
                                             -additionalArguments $AdditionalArguments `
                                             -azCopyToolLocation "AzCopy" `
                                             -fileCopyJobScript $AzureFileCopyRemoteJob `
                                             -enableDetailedLogging $false `
                                             -useSanitizerActivate $true `
                                             -useSourcePathHardening $true

    Assert-IsNotNullOrEmpty $global:capturedRemoteScriptJobArgs "Expected Copy-FilesSequentiallyToAzureVMs to have been called."
    $index = [array]::IndexOf($global:capturedRemoteScriptJobArgs, '-remoteScriptJobArguments')
    Assert-AreNotEqual -1 $index "Expected -remoteScriptJobArguments to have been passed to Copy-FilesSequentiallyToAzureVMs."
    return $global:capturedRemoteScriptJobArgs[$index + 1].scriptArguments
}

# Runs the real runner and returns everything it printed.
function Invoke-RealRunner
{
    param([string]$ScriptArguments)

    return (& $ExecutePsScript -scriptPath '' -scriptArguments $ScriptArguments -inlineScript $standInRemoteJob -inline $true `
                               -workingDirectory '' -_errorActionPreference 'Stop' -ignoreLASTEXITCODE $false -failOnStdErr $false `
                               -initializationScriptPath '' -sessionVariables '' 2>&1 | Out-String)
}

function Get-ReceivedValue
{
    param(
        [string]$Output,
        [string]$Name
    )

    $match = [regex]::Match($Output, "RECEIVED $Name=([A-Za-z0-9+/=]*)")
    if (!$match.Success)
    {
        $excerpt = $Output.Trim()
        if ($excerpt.Length -gt 400) { $excerpt = $excerpt.Substring(0, 400) }
        throw "The remote runner did not report '$Name'. Output: $excerpt"
    }
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($match.Groups[1].Value))
}

function Assert-RealRunnerScenario
{
    param([hashtable]$Scenario)

    $additionalArguments = ""
    if ($Scenario.ContainsKey('AdditionalArguments'))
    {
        $additionalArguments = $Scenario.AdditionalArguments
    }

    $scriptArguments = Get-GeneratedScriptArguments -TargetPath $Scenario.TargetPath -AdditionalArguments $additionalArguments
    $output = Invoke-RealRunner -ScriptArguments $scriptArguments

    Assert-AreEqual $false ([regex]::IsMatch($output, '(?m)^INJECTED-MARKER\s*$')) "[$($Scenario.Name)] Nothing injected through the arguments may run on the VM."
    Assert-AreEqual $Scenario.TargetPath (Get-ReceivedValue -Output $output -Name 'targetPath') "[$($Scenario.Name)] TargetPath must reach the remote job unchanged."
    Assert-AreEqual $additionalArguments (Get-ReceivedValue -Output $output -Name 'additionalArguments') "[$($Scenario.Name)] AdditionalArguments must reach the remote job unchanged."
    Assert-AreEqual $true ([regex]::IsMatch($output, '(?m)^RECEIVED hardeningSwitch=True\s*$')) "[$($Scenario.Name)] -useSourcePathHardening must still be passed to the remote job."
}

$quote = [string][char]0x2019

$scenarios = @(
    @{ Name = 'ASCII quote break-out in TargetPath'
       TargetPath = "C:\Temp'; Write-Output INJECTED-MARKER; #" },
    @{ Name = 'typographic quote break-out in TargetPath'
       TargetPath = ("C:\Temp" + $quote + "; Write-Output INJECTED-MARKER; #") },
    @{ Name = 'legitimate TargetPath containing a typographic quote'
       TargetPath = ("C:\Users\Bob" + $quote + "s Files\deploy") },
    @{ Name = 'legitimate TargetPath containing an apostrophe'
       TargetPath = "C:\Users\Bob's Files\deploy" },
    @{ Name = 'typographic quote break-out in AdditionalArguments'
       TargetPath = 'C:\Temp\files'
       AdditionalArguments = ("--x" + $quote + "; Write-Output INJECTED-MARKER; #") },
    @{ Name = 'legitimate AdditionalArguments containing an apostrophe'
       TargetPath = 'C:\Temp\files'
       AdditionalArguments = '--include-pattern "Bob''s Files\*" --recursive' }
)

foreach ($scenario in $scenarios)
{
    Assert-RealRunnerScenario -Scenario $scenario
}
