[CmdletBinding()]
param()

# Regression test for a TargetPath command-injection fix in
# Copy-FilesToAzureVMsFromStorageContainer: TargetPath (and ContainerURL,
# defensively) used to be embedded unescaped into a single-quoted PowerShell
# literal that becomes part of the text handed to the remote job
# (scriptArguments). On the target VM, RunPowerShellScriptJob.ps1 splices
# that text, unescaped, after the scriptblock invocation and re-parses it -
# so an embedded single quote in TargetPath could terminate the literal
# early and inject arbitrary PowerShell statements.
#
# The fix doubles embedded single quotes (' -> '') before building
# scriptArguments, matching the escaping already applied to $scriptPath in
# RunPowerShellScriptJob.ps1. This test proves, end to end, that:
#   1) A malicious TargetPath can no longer inject/execute extra statements
#      when the generated scriptArguments text is parsed/invoked exactly as
#      RunPowerShellScriptJob.ps1 does on the target VM.
#   2) The original (unescaped) TargetPath value still round-trips intact
#      to the remote job - i.e. the fix is transparent for legitimate input,
#      including input that happens to contain a literal single quote.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\..\AzureFileCopyRemoteJob.ps1
. $PSScriptRoot\MockHelper.ps1

$azureVMsProperties = Get-AzureVMResourcesProperties -resourceGroupName $validRG -resourceFilteringMethod 'tags'
$azureVMCredntials = Get-AzureVMsCredentials -vmsAdminUserName $validInputVmsAdminUserName -vmsAdminPassword $validInputVmsAdminPassword

Register-Mock Get-ChildItem { }
Register-Mock ConvertTo-SecureString { return $securedMockPassword }

# Capture the raw arguments passed to Copy-FilesSequentiallyToAzureVMs so the
# real $remoteScriptJobArguments hashtable (built by
# Copy-FilesToAzureVMsFromStorageContainer) can be inspected and then
# actually executed below, the same way RunPowerShellScriptJob.ps1 invokes
# it on the target VM.
Register-Mock Copy-FilesSequentiallyToAzureVMs { $global:capturedRemoteScriptJobArgs = $args }
Register-Mock Copy-FilesParallellyToAzureVMs { }

$invokeRemoteScriptParams = Get-InvokeRemoteScriptParameters -azureVMResourcesProperties $azureVMsProperties -networkCredentials $azureVMCredntials

# A TargetPath containing an embedded single quote crafted to break out of
# the single-quoted -targetPath '...' literal and inject an extra statement,
# then comment out the remainder of the generated invocation line.
$global:injectionOccurred = $false
$maliciousTargetPath = "C:\Temp'; `$global:injectionOccurred = `$true; #"

Copy-FilesToAzureVMsFromStorageContainer -targetMachineNames $invokeRemoteScriptParams.targetMachineNames -credential $invokeRemoteScriptParams.credential `
                                         -protocol $invokeRemoteScriptParams.protocol `
                                         -sessionOption $invokeRemoteScriptParams.sessionOption `
                                         -blobStorageEndpoint $validBlobStorageEndpoint `
                                         -containerName $validInputContainerName `
                                         -targetPath $maliciousTargetPath `
                                         -cleanTargetBeforeCopy $false `
                                         -copyFilesInParallel $false `
                                         -additionalArguments "" `
                                         -azCopyToolLocation "AzCopy" `
                                         -fileCopyJobScript $AzureFileCopyRemoteJob `
                                         -enableDetailedLogging $false `
                                         -useSourcePathHardening $true

Assert-WasCalled Copy-FilesSequentiallyToAzureVMs -Times 1

$remoteScriptJobArgumentsIndex = [array]::IndexOf($global:capturedRemoteScriptJobArgs, '-remoteScriptJobArguments')
Assert-AreNotEqual -1 $remoteScriptJobArgumentsIndex "Expected -remoteScriptJobArguments to have been passed to Copy-FilesSequentiallyToAzureVMs."
$remoteScriptJobArguments = $global:capturedRemoteScriptJobArgs[$remoteScriptJobArgumentsIndex + 1]

# Fake the remote 'azcopy' command (PowerShell resolves a function ahead of
# an external application of the same name) to capture the argv that
# actually reaches it once the generated remote-job scriptblock is invoked
# exactly as RunPowerShellScriptJob.ps1 does on the target VM.
$global:capturedAzCopyArgs = $null
function global:azcopy
{
    if ($args.Count -gt 0 -and $args[0] -eq '--version')
    {
        return "azcopy version 10.25.1"
    }
    $global:capturedAzCopyArgs = $args
}

try
{
    $remoteJobScriptBlock = [scriptblock]::Create($remoteScriptJobArguments.inlineScript)
    $invokeCommandText = "& `$remoteJobScriptBlock $($remoteScriptJobArguments.scriptArguments.Trim())"
    Invoke-Expression $invokeCommandText

    Assert-AreEqual $false $global:injectionOccurred "A malicious single-quote in TargetPath must not be able to inject and execute extra PowerShell statements."

    Assert-IsNotNullOrEmpty $global:capturedAzCopyArgs "Expected the remote job to still invoke azcopy with the (safely escaped) TargetPath."
    $targetPathIndex = [array]::IndexOf($global:capturedAzCopyArgs, "$validBlobStorageEndpoint/$validInputContainerName/*")
    Assert-AreNotEqual -1 $targetPathIndex "Expected the container URL to be a captured argument. Captured argv: $($global:capturedAzCopyArgs -join '|')"
    Assert-AreEqual $maliciousTargetPath $global:capturedAzCopyArgs[$targetPathIndex + 1] "The original TargetPath value (including its literal single quote) must round-trip intact to the remote job once parsed back out of the escaped literal. Captured argv: $($global:capturedAzCopyArgs -join '|')"
}
finally
{
    Remove-Item -Path function:global:azcopy -ErrorAction SilentlyContinue
}
