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
# The fix escapes both values with
# [System.Management.Automation.Language.CodeGeneration]::EscapeSingleQuotedStringContent
# before building scriptArguments. Doubling only the ASCII apostrophe
# (' -> '') is not enough: PowerShell also treats the typographic quotes
# U+2018, U+2019, U+201A and U+201B as single-quote delimiters, so a TargetPath
# containing one of them could still terminate the literal. This test proves,
# end to end, for the ASCII apostrophe and for each of those typographic
# quotes, that:
#   1) A malicious TargetPath can no longer inject/execute extra statements
#      when the generated scriptArguments text is parsed/invoked exactly as
#      RunPowerShellScriptJob.ps1 does on the target VM.
#   2) The original (unescaped) TargetPath value still round-trips intact
#      to the remote job - i.e. the fix is transparent for legitimate input,
#      including input that happens to contain a literal quote character.
#
# The escaping is applied before, and independently of, the feature flags, so the same checks
# are also run:
#   - for the container name, which ends up in the same kind of literal (ContainerURL);
#   - with the sanitizer enabled but SourcePath hardening disabled, the one flag combination
#     that takes a different branch in AzureFileCopyRemoteJob.ps1.
#
# The typographic quotes are built from their code points on purpose: the
# repository files are BOM-less, and Windows PowerShell 5.1 would read a
# literal non-ASCII character in such a file using the ANSI code page.

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

# Drives Copy-FilesToAzureVMsFromStorageContainer with the given TargetPath,
# then executes the generated remote-job scriptblock the way the target VM
# does, and asserts that no injected statement ran and that the TargetPath
# reached azcopy unchanged.
$global:copyCallCount = 0
function Assert-TargetPathStaysLiteral
{
    param(
        [string]$TargetPath,
        [string]$Description,
        [string]$ContainerName = $validInputContainerName,
        [bool]$UseSanitizerActivate = $false,
        [bool]$UseSourcePathHardening = $true
    )

    $global:injectionOccurred = $false
    $global:capturedAzCopyArgs = $null
    $global:capturedRemoteScriptJobArgs = $null

    Copy-FilesToAzureVMsFromStorageContainer -targetMachineNames $invokeRemoteScriptParams.targetMachineNames -credential $invokeRemoteScriptParams.credential `
                                             -protocol $invokeRemoteScriptParams.protocol `
                                             -sessionOption $invokeRemoteScriptParams.sessionOption `
                                             -blobStorageEndpoint $validBlobStorageEndpoint `
                                             -containerName $ContainerName `
                                             -targetPath $TargetPath `
                                             -cleanTargetBeforeCopy $false `
                                             -copyFilesInParallel $false `
                                             -additionalArguments "" `
                                             -azCopyToolLocation "AzCopy" `
                                             -fileCopyJobScript $AzureFileCopyRemoteJob `
                                             -enableDetailedLogging $false `
                                             -useSanitizerActivate $UseSanitizerActivate `
                                             -useSourcePathHardening $UseSourcePathHardening

    $global:copyCallCount++
    Assert-WasCalled Copy-FilesSequentiallyToAzureVMs -Times $global:copyCallCount

    $remoteScriptJobArgumentsIndex = [array]::IndexOf($global:capturedRemoteScriptJobArgs, '-remoteScriptJobArguments')
    Assert-AreNotEqual -1 $remoteScriptJobArgumentsIndex "[$Description] Expected -remoteScriptJobArguments to have been passed to Copy-FilesSequentiallyToAzureVMs."
    $remoteScriptJobArguments = $global:capturedRemoteScriptJobArgs[$remoteScriptJobArgumentsIndex + 1]

    $remoteJobScriptBlock = [scriptblock]::Create($remoteScriptJobArguments.inlineScript)
    $invokeCommandText = "& `$remoteJobScriptBlock $($remoteScriptJobArguments.scriptArguments.Trim())"
    Invoke-Expression $invokeCommandText

    Assert-AreEqual $false $global:injectionOccurred "[$Description] A quote character in TargetPath must not be able to inject and execute extra PowerShell statements."

    Assert-IsNotNullOrEmpty $global:capturedAzCopyArgs "[$Description] Expected the remote job to still invoke azcopy with the (safely escaped) TargetPath."
    $targetPathIndex = [array]::IndexOf($global:capturedAzCopyArgs, "$validBlobStorageEndpoint/$ContainerName/*")
    Assert-AreNotEqual -1 $targetPathIndex "[$Description] Expected the container URL to be a captured argument. Captured argv: $($global:capturedAzCopyArgs -join '|')"
    Assert-AreEqual $TargetPath $global:capturedAzCopyArgs[$targetPathIndex + 1] "[$Description] The original TargetPath value (including its literal quote character) must round-trip intact to the remote job once parsed back out of the escaped literal. Captured argv: $($global:capturedAzCopyArgs -join '|')"
}

# Every character PowerShell accepts as a single-quote delimiter.
$quoteCharacters = @(
    @{ Name = "ASCII apostrophe (U+0027)";                          Value = [string][char]0x0027 },
    @{ Name = "left single quotation mark (U+2018)";                Value = [string][char]0x2018 },
    @{ Name = "right single quotation mark (U+2019)";               Value = [string][char]0x2019 },
    @{ Name = "single low-9 quotation mark (U+201A)";               Value = [string][char]0x201A },
    @{ Name = "single high-reversed-9 quotation mark (U+201B)";     Value = [string][char]0x201B }
)

$checks = @()
foreach ($quote in $quoteCharacters)
{
    # A TargetPath crafted to break out of the single-quoted -targetPath '...'
    # literal with this quote character, inject an extra statement, then comment
    # out the remainder of the generated invocation line.
    $maliciousTargetPath = "C:\Temp" + $quote.Value + "; `$global:injectionOccurred = `$true; #"
    # A legitimate path that merely contains the same character must survive untouched.
    $legitimateTargetPath = "C:\Users\Bob" + $quote.Value + "s Files\deploy"
    # The container name ends up in the same kind of single-quoted literal (ContainerURL).
    $maliciousContainerName = "c" + $quote.Value + "; `$global:injectionOccurred = `$true; #"
    $legitimateContainerName = "my" + $quote.Value + "container"

    # SourcePath hardening on (the configuration this test always used).
    $checks += @{ TargetPath = $maliciousTargetPath;  Description = "malicious TargetPath using $($quote.Name)" }
    $checks += @{ TargetPath = $legitimateTargetPath; Description = "legitimate TargetPath containing $($quote.Name)" }

    # Sanitizer on, hardening off: the remaining branch of the remote job that passes the path as data.
    $checks += @{ TargetPath = $maliciousTargetPath;  Description = "malicious TargetPath using $($quote.Name), sanitizer only";  UseSanitizerActivate = $true; UseSourcePathHardening = $false }
    $checks += @{ TargetPath = $legitimateTargetPath; Description = "legitimate TargetPath containing $($quote.Name), sanitizer only"; UseSanitizerActivate = $true; UseSourcePathHardening = $false }

    $checks += @{ TargetPath = 'C:\Temp\files'; ContainerName = $maliciousContainerName;  Description = "malicious container name using $($quote.Name)" }
    $checks += @{ TargetPath = 'C:\Temp\files'; ContainerName = $legitimateContainerName; Description = "legitimate container name containing $($quote.Name)" }
}

try
{
    foreach ($check in $checks)
    {
        Assert-TargetPathStaysLiteral @check
    }
}
finally
{
    Remove-Item -Path function:global:azcopy -ErrorAction SilentlyContinue
}
