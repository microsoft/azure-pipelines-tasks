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
#      remote job delivers a multi-word sanitized token to a real AzCopy.exe
#      process intact.
#
# Unlike V4-V6, this task's remote job (classic AzCopy) rebuilds a real
# AzCopy.exe on the target VM from the base64-encoded contents of
# -azCopyToolLocation, then invokes that exe by its literal file path (not a
# bare command name), so it cannot be intercepted with a same-named function
# the way V4-V6's bare "azcopy" command can. This test points
# -azCopyToolLocation at a real folder containing a compiled fake AzCopy.exe
# (same technique as L0UploadFilesToAzureContainer.SourcePathHardening.SanitizerCombined.ps1)
# so the full, real round trip - including the on-VM re-materialization of
# the exe - is exercised exactly as it would run in production, and the argv
# the fake exe actually receives is captured and asserted for a token that
# needs whitespace-quoting.
#
# Note: this test deliberately does not push a token with an embedded double
# quote through the real AzCopy.exe process. PowerShell's own native-command
# argument marshalling only double-quotes an argument that contains
# whitespace and does not backslash-escape an embedded double-quote
# character within it, so an argument such as a"b c gets corrupted by the OS
# command-line encoding itself when passed to *any* real external
# executable (confirmed via an isolated repro) - a separate, pre-existing
# limitation of invoking native processes from PowerShell, unrelated to the
# Join-SanitizedArguments / Split-AdditionalArguments round trip. That
# scenario is already covered at the array level (before that OS boundary)
# in the shared Common/Sanitizer test referenced above.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\..\AzureFileCopyRemoteJob.ps1
. $PSScriptRoot\MockHelper.ps1

$rgWithClassicVMs = "taskplatformtesttwovm"
$azureVMsProperties = Get-AzureVMResourcesProperties -resourceGroupName $rgWithClassicVMs -connectionType 'Certificate' -resourceFilteringMethod 'tags'
$azureVMCredntials = Get-AzureVMsCredentials -vmsAdminUserName $validInputVmsAdminUserName -vmsAdminPassword $validInputVmsAdminPassword

Register-Mock ConvertTo-SecureString { return $securedMockPassword }

# Capture the raw arguments passed to Copy-FilesSequentiallyToAzureVMs so the
# real $remoteScriptJobArguments hashtable (built by
# Copy-FilesToAzureVMsFromStorageContainer with the placeholder already
# replaced) can be inspected and then actually executed below.
Register-Mock Copy-FilesSequentiallyToAzureVMs { $global:capturedRemoteScriptJobArgs = $args }
Register-Mock Copy-FilesParallellyToAzureVMs { }

$invokeRemoteScriptParams = Get-InvokeRemoteScriptParameters -azureVMResourcesProperties $azureVMsProperties -networkCredentials $azureVMCredntials

# Note: Get-ChildItem is deliberately NOT mocked in this test (unlike the
# other Copy-FilesToAzureVMsFromStorageContainer L0 tests) - the fake
# AzCopy.exe below must actually be read from disk and base64-encoded by
# Copy-FilesToAzureVMsFromStorageContainer so the remote job can
# re-materialize and execute a real executable, exactly as it does on a real
# target VM.
$fakeAzCopyDir = Join-Path $env:TEMP "msrc128417-vmcopy-sanitizercombined-l0-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $fakeAzCopyDir -Force | Out-Null
$fakeAzCopyExe = Join-Path $fakeAzCopyDir 'AzCopy.exe'
$capturedArgsFile = Join-Path $fakeAzCopyDir 'captured-args.txt'
Add-Type -OutputType ConsoleApplication -OutputAssembly $fakeAzCopyExe -TypeDefinition @"
using System;
using System.IO;
public class FakeAzCopy {
    public static int Main(string[] args) {
        File.WriteAllLines(@"$capturedArgsFile", args);
        return 0;
    }
}
"@

try
{
    # Simulates the array Protect-ScriptArguments (-AllowDataConstructors)
    # would return: a sanitized token containing whitespace, which requires
    # Join-SanitizedArguments to re-quote it so Split-AdditionalArguments
    # doesn't mis-split it on the remote job.
    $sanitizedTokens = @('--include-pattern', 'sub folder\a.txt', '--recursive')
    $additionalArguments = Join-SanitizedArguments -arguments $sanitizedTokens

    Copy-FilesToAzureVMsFromStorageContainer -targetMachineNames $invokeRemoteScriptParams.targetMachineNames -credential $invokeRemoteScriptParams.credential `
                                             -protocol $invokeRemoteScriptParams.protocol `
                                             -sessionOption $invokeRemoteScriptParams.sessionOption `
                                             -blobStorageEndpoint $validBlobStorageEndpoint `
                                             -containerName $validInputContainerName `
                                             -containerSasToken $validSasToken `
                                             -targetPath $validInputTargetPath `
                                             -cleanTargetBeforeCopy $false `
                                             -copyFilesInParallel $false `
                                             -additionalArguments $additionalArguments `
                                             -azCopyToolLocation $fakeAzCopyDir `
                                             -fileCopyJobScript $AzureFileCopyRemoteJob `
                                             -enableDetailedLogging $false `
                                             -useSanitizerActivate $true `
                                             -useSourcePathHardening $true

    Assert-WasCalled Copy-FilesSequentiallyToAzureVMs -Times 1

    $remoteScriptJobArgumentsIndex = [array]::IndexOf($global:capturedRemoteScriptJobArgs, '-remoteScriptJobArguments')
    Assert-AreNotEqual -1 $remoteScriptJobArgumentsIndex "Expected -remoteScriptJobArguments to have been passed to Copy-FilesSequentiallyToAzureVMs."
    $remoteScriptJobArguments = $global:capturedRemoteScriptJobArgs[$remoteScriptJobArgumentsIndex + 1]

    Assert-AreEqual $false ($remoteScriptJobArguments.inlineScript.Contains('# Split-AdditionalArguments-Placeholder')) "Expected the '# Split-AdditionalArguments-Placeholder' comment to be replaced with a real Split-AdditionalArguments implementation when -useSourcePathHardening is enabled."
    $inlinedSplitAdditionalArgumentsSource = $remoteScriptJobArguments.inlineScript
    Assert-AreEqual $true ($inlinedSplitAdditionalArgumentsSource.Contains('StringBuilder')) "Expected the inlined Split-AdditionalArguments implementation to be the real one exported by the Sanitizer module (identified by its use of StringBuilder), not an empty/placeholder stub."

    # Verify the inlined implementation is byte-for-byte the same one
    # currently exported by the Sanitizer module, so the assertion below
    # (calling the locally-loaded Split-AdditionalArguments) is a faithful
    # stand-in for calling the one actually baked into the remote job.
    $liveSplitAdditionalArgumentsSource = (Get-Item -Path function:Split-AdditionalArguments).ScriptBlock.ToString()
    Assert-AreEqual $true ($inlinedSplitAdditionalArgumentsSource.Contains($liveSplitAdditionalArgumentsSource.Trim())) "Expected the Split-AdditionalArguments implementation inlined into the remote job to be identical to the one currently exported by the Sanitizer module."

    # Actually execute the generated remote-job scriptblock the same way
    # RunPowerShellScriptJob.ps1 invokes it on the target VM - splicing the
    # raw scriptArguments string after the scriptblock. This re-materializes
    # our fake AzCopy.exe under $env:windir\DtlDownloads and invokes it for
    # real, proving the base64 round trip and the whitespace-only quoting
    # case survive the whole real pipeline end to end.
    $remoteJobScriptBlock = [scriptblock]::Create($remoteScriptJobArguments.inlineScript)
    $invokeCommandText = "& `$remoteJobScriptBlock $($remoteScriptJobArguments.scriptArguments.Trim())"
    Invoke-Expression $invokeCommandText

    Assert-IsNotNullOrEmpty (Test-Path $capturedArgsFile) "Expected the fake AzCopy.exe invocation to have been captured."
    $capturedArgs = @(Get-Content -Path $capturedArgsFile)

    $includePatternIndex = [array]::IndexOf($capturedArgs, '--include-pattern')
    Assert-AreNotEqual -1 $includePatternIndex "Expected '--include-pattern' to be a captured argument. Captured argv: $($capturedArgs -join '|')"
    Assert-AreEqual 'sub folder\a.txt' $capturedArgs[$includePatternIndex + 1] "A sanitized token containing whitespace must survive the Join-SanitizedArguments -> Split-AdditionalArguments round trip as one intact argument. Captured argv: $($capturedArgs -join '|')"
    Assert-AreEqual $true ($capturedArgs -contains '--recursive') "Expected '--recursive' to be a captured argument. Captured argv: $($capturedArgs -join '|')"
}
finally
{
    Remove-Item -Path $fakeAzCopyDir -Recurse -Force -ErrorAction SilentlyContinue
}
