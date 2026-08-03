[CmdletBinding()]
param()

# Regression test for a bug found when both the sanitizer (AZP_75787,
# -useSanitizerActivate) and the MSRC 128417 SourcePath hardening
# (-useSourcePathHardening) are enabled together.
#
# AzureFileCopy.ps1 sanitizes additionalArguments into an array of tokens via
# Protect-ScriptArguments, then rejoins that array into a single string
# (Join-SanitizedArguments) before handing it to Upload-FilesToAzureContainer.
# When hardening is also enabled, Upload-FilesToAzureContainer re-splits that
# string via Split-AdditionalArguments to build the call-operator argv.
# Join-SanitizedArguments must re-quote any token containing an embedded space
# before rejoining, otherwise that round trip loses the original token
# boundaries and a value like "sub folder\a.txt" gets split into two
# arguments.
#
# This is not a rare combination: on scale units where the sanitizer's
# enforce mode (AZP_75787_ENABLE_NEW_LOGIC) is active, -useSanitizerActivate
# is true for the vast majority of pipelines, so once SourcePath hardening is
# enabled this combined path becomes the common case, not the exception.
#
# This test simulates that full round trip: it starts from the sanitized
# token array (as Protect-ScriptArguments would produce, with the original
# quotes already stripped), joins it exactly as AzureFileCopy.ps1 does, and
# passes the joined string into Upload-FilesToAzureContainer with both flags
# enabled, asserting the value with the embedded space survives as one token.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1

Register-Mock Write-Telemetry { }
$fakeResponseFile = Join-Path $env:TEMP "msrc128417-sanitizercombined-l0-responsefile-$([guid]::NewGuid())"
Register-Mock Get-VstsTaskVariable { return $fakeResponseFile }

$fakeAzCopyDir = Join-Path $env:TEMP "msrc128417-sanitizercombined-l0-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $fakeAzCopyDir -Force | Out-Null
$fakeAzCopyExe = Join-Path $fakeAzCopyDir 'AzCopy.exe'
$argsCaptureFile = Join-Path $fakeAzCopyDir 'captured-args.txt'
Add-Type -OutputType ConsoleApplication -OutputAssembly $fakeAzCopyExe -TypeDefinition @"
using System;
using System.IO;
public class FakeAzCopy {
    public static int Main(string[] args) {
        File.WriteAllLines(@"$argsCaptureFile", args);
        return 0;
    }
}
"@

try {
    New-Item -ItemType File -Path $fakeResponseFile -Force | Out-Null

    # Simulates the array Protect-ScriptArguments would return: quotes already
    # stripped from the original "sub folder\a.txt" value.
    $sanitizedTokens = @('--include-pattern', 'sub folder\a.txt', '--recursive')
    $additionalArguments = Join-SanitizedArguments -arguments $sanitizedTokens

    Upload-FilesToAzureContainer -sourcePath 'C:\src' `
        -storageAccountName 'validstorage' `
        -containerName 'validcontainer' `
        -blobPrefix '' `
        -blobStorageEndpoint 'https://validstorage.blob.core.windows.net' `
        -storageKey 'validkey' `
        -azCopyLocation $fakeAzCopyDir `
        -additionalArguments $additionalArguments `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -useSanitizerActivate $true `
        -useSourcePathHardening $true

    Assert-IsNotNullOrEmpty (Test-Path $argsCaptureFile) "Expected the fake AzCopy.exe to have been invoked and to have captured its argv."
    $capturedArgs = @(Get-Content -Path $argsCaptureFile)

    $includePatternIndex = [array]::IndexOf($capturedArgs, '--include-pattern')
    Assert-AreNotEqual -1 $includePatternIndex "Expected '--include-pattern' to be a captured argument. Captured argv: $($capturedArgs -join '|')"
    Assert-AreEqual 'sub folder\a.txt' $capturedArgs[$includePatternIndex + 1] "A sanitized value with an embedded space must survive the sanitizer+hardening round trip as one intact argument, not split on the embedded space. Captured argv: $($capturedArgs -join '|')"

    Assert-AreEqual $true ($capturedArgs -contains '--recursive') "Expected '--recursive' to be a captured argument. Captured argv: $($capturedArgs -join '|')"
}
finally {
    Remove-Item -Path $fakeAzCopyDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $fakeResponseFile -Force -ErrorAction SilentlyContinue
}
