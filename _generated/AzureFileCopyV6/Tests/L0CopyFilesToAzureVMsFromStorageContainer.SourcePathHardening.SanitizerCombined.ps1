[CmdletBinding()]
param()

# Regression/coverage test for a PR review follow-up on the MSRC 128417
# SourcePath hardening work: nothing previously drove
# Copy-FilesToAzureVMsFromStorageContainer (the VM-copy path) with
# -useSourcePathHardening through a *real* Sanitizer module import - the
# placeholder replacement and the resulting @splat invocation on the remote
# job shipped untested. That gap would have hidden both:
#
#   1) A NullReferenceException if Get-Item function:Split-AdditionalArguments
#      ever failed to resolve (e.g. a future rename/scope change in the
#      Sanitizer module) - now guarded by an explicit throw in
#      Copy-FilesToAzureVMsFromStorageContainer.
#   2) A lossy Join-SanitizedArguments round trip: with both the sanitizer
#      (-useSanitizerActivate) and hardening (-useSourcePathHardening)
#      enabled, a sanitized token containing whitespace and/or an embedded
#      quote could be mis-split by the remote job's Split-AdditionalArguments.
#      The Join-SanitizedArguments/Split-AdditionalArguments round-trip logic
#      itself (including the embedded-double-quote escaping regression) is
#      covered once, centrally, in
#      Tasks/Common/Sanitizer/Tests/L0Join-SanitizedArguments.ps1 - this test
#      does not re-verify that logic. It only proves the *wiring* specific to
#      this task version: the placeholder gets replaced with the real
#      Sanitizer implementation, and the resulting @splat invocation on the
#      remote job delivers a multi-word sanitized token to azcopy intact.
#
# This test exercises the full round trip: it builds a sanitized token array
# (as Protect-ScriptArguments would produce), joins it exactly as
# AzureFileCopy.ps1 does, drives Copy-FilesToAzureVMsFromStorageContainer
# with both flags enabled, then actually executes the generated remote-job
# scriptblock (after placeholder replacement) the same way
# RunPowerShellScriptJob.ps1 invokes it on the target VM - splicing the raw
# scriptArguments string after the scriptblock - asserting the sanitized
# token survives as one intact argument reaching azcopy.

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
# Copy-FilesToAzureVMsFromStorageContainer with the placeholder already
# replaced) can be inspected and then actually executed below.
Register-Mock Copy-FilesSequentiallyToAzureVMs { $global:capturedRemoteScriptJobArgs = $args }
Register-Mock Copy-FilesParallellyToAzureVMs { }

$invokeRemoteScriptParams = Get-InvokeRemoteScriptParameters -azureVMResourcesProperties $azureVMsProperties -networkCredentials $azureVMCredntials

# Simulates the array Protect-ScriptArguments (-AllowDataConstructors) would
# return: a sanitized token containing whitespace, which requires
# Join-SanitizedArguments to re-quote it so the remote job's
# Split-AdditionalArguments doesn't mis-split it.
$sanitizedTokens = @('--include-pattern', 'sub folder\a.txt', '--recursive')
$additionalArguments = Join-SanitizedArguments -arguments $sanitizedTokens

Copy-FilesToAzureVMsFromStorageContainer -targetMachineNames $invokeRemoteScriptParams.targetMachineNames -credential $invokeRemoteScriptParams.credential `
                                         -protocol $invokeRemoteScriptParams.protocol `
                                         -sessionOption $invokeRemoteScriptParams.sessionOption `
                                         -blobStorageEndpoint $validBlobStorageEndpoint `
                                         -containerName $validInputContainerName `
                                         -targetPath $validInputTargetPath `
                                         -cleanTargetBeforeCopy $false `
                                         -copyFilesInParallel $false `
                                         -additionalArguments $additionalArguments `
                                         -azCopyToolLocation "AzCopy" `
                                         -fileCopyJobScript $AzureFileCopyRemoteJob `
                                         -enableDetailedLogging $false `
                                         -useSanitizerActivate $true `
                                         -useSourcePathHardening $true

Assert-WasCalled Copy-FilesSequentiallyToAzureVMs -Times 1

$remoteScriptJobArgumentsIndex = [array]::IndexOf($global:capturedRemoteScriptJobArgs, '-remoteScriptJobArguments')
Assert-AreNotEqual -1 $remoteScriptJobArgumentsIndex "Expected -remoteScriptJobArguments to have been passed to Copy-FilesSequentiallyToAzureVMs."
$remoteScriptJobArguments = $global:capturedRemoteScriptJobArgs[$remoteScriptJobArgumentsIndex + 1]

Assert-AreEqual $false ($remoteScriptJobArguments.inlineScript.Contains('# Split-AdditionalArguments-Placeholder')) "Expected the '# Split-AdditionalArguments-Placeholder' comment to be replaced with a real Split-AdditionalArguments implementation when -useSourcePathHardening is enabled."
Assert-AreEqual $true ($remoteScriptJobArguments.inlineScript.Contains('StringBuilder')) "Expected the inlined Split-AdditionalArguments implementation to be the real one exported by the Sanitizer module (identified by its use of StringBuilder), not an empty/placeholder stub."

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

    Assert-IsNotNullOrEmpty $global:capturedAzCopyArgs "Expected the remote job to invoke azcopy."

    $includePatternIndex = [array]::IndexOf($global:capturedAzCopyArgs, '--include-pattern')
    Assert-AreNotEqual -1 $includePatternIndex "Expected '--include-pattern' to be a captured argument. Captured argv: $($global:capturedAzCopyArgs -join '|')"
    Assert-AreEqual 'sub folder\a.txt' $global:capturedAzCopyArgs[$includePatternIndex + 1] "A sanitized token containing whitespace must survive the Join-SanitizedArguments -> Split-AdditionalArguments round trip as one intact argument. Captured argv: $($global:capturedAzCopyArgs -join '|')"
    Assert-AreEqual $true ($global:capturedAzCopyArgs -contains '--recursive') "Expected '--recursive' to be a captured argument. Captured argv: $($global:capturedAzCopyArgs -join '|')"
}
finally
{
    Remove-Item -Path function:global:azcopy -ErrorAction SilentlyContinue
}
