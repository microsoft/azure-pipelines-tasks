[CmdletBinding()]
param()

# Regression test for a follow-up correctness bug found in the MSRC 128417
# SourcePath hardening fix (see L0UploadFilesToAzureContainer.SourcePathHardening.ps1
# and .QuoteStripping.ps1).
#
# The hardened path's tokenizer originally only understood double quotes when
# splitting $additionalArguments into discrete tokens for the call operator.
# A single-quoted value (e.g. --path='a b', a common shell-style convention)
# was not recognized as a grouping construct at all: the embedded space split
# it into two separate tokens, and the literal single-quote characters were
# left in place (since only double quotes were stripped), corrupting the
# value AzCopy.exe received. This is a regression relative to the legacy
# Invoke-Expression path, whose PowerShell string-literal parsing understands
# single quotes natively.
#
# This test proves the fix by capturing the real argv a native process
# receives from the hardened call-operator invocation and asserting a
# single-quoted value with an embedded space survives as one token with the
# quote characters stripped, and that single/double quotes can be mixed
# within the same additionalArguments string.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1

Register-Mock Write-Telemetry { }
# The response file lookup path is unrelated to this test; make it resolve to a real,
# already-existing temp file (rather than mocking Test-Path itself) so
# Upload-FilesToAzureContainer skips creating a real one without interfering with the
# Test-Path calls this test makes on the AzCopy.exe argv capture files below.
# Upload-FilesToAzureContainer deletes this file itself in its own finally block, so it
# must be recreated before each invocation of the function.
$fakeResponseFile = Join-Path $env:TEMP "msrc128417-singlequote-l0-responsefile-$([guid]::NewGuid())"
Register-Mock Get-VstsTaskVariable { return $fakeResponseFile }

# Stand in for AzCopy.exe with a trivial, freshly compiled executable that
# records the exact argv it receives (one line per argument) so the test can
# assert on what the hardened call-operator path actually passes to a real
# native process, without performing any real copy/network operation. This
# version's Upload-FilesToAzureContainer invokes AzCopy exactly once (no
# separate login/logout calls), so a single capture file is sufficient.
$fakeAzCopyDir = Join-Path $env:TEMP "msrc128417-singlequote-l0-$([guid]::NewGuid())"
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

    Upload-FilesToAzureContainer -sourcePath 'C:\src' `
        -storageAccountName 'validstorage' `
        -containerName 'validcontainer' `
        -blobPrefix '' `
        -blobStorageEndpoint 'https://validstorage.blob.core.windows.net' `
        -storageKey 'validkey' `
        -azCopyLocation $fakeAzCopyDir `
        -additionalArguments "--path='sub folder\a.txt' --cap-mbps 500" `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -useSanitizerActivate $false `
        -useSourcePathHardening $true

    Assert-IsNotNullOrEmpty (Test-Path $argsCaptureFile) "Expected the fake AzCopy.exe to have been invoked and to have captured its argv."
    $capturedArgs = @(Get-Content -Path $argsCaptureFile)

    Assert-AreEqual $false (($capturedArgs -join '|').Contains("'")) "Hardened path must strip single-quote characters used purely as token delimiters, just like double quotes; found a literal single quote in the captured argv: $($capturedArgs -join '|')"

    Assert-AreEqual $true ($capturedArgs -contains "--path=sub folder\a.txt") "A single-quoted value with an embedded space must be passed as one intact argument with the quote characters stripped, not split on the embedded space. Captured argv: $($capturedArgs -join '|')"

    Assert-AreEqual $true ($capturedArgs -contains '--cap-mbps') "Expected '--cap-mbps' to be a captured argument. Captured argv: $($capturedArgs -join '|')"
    Assert-AreEqual $true ($capturedArgs -contains '500') "Expected '500' to be a captured argument. Captured argv: $($capturedArgs -join '|')"
}
finally {
    Remove-Item -Path $fakeAzCopyDir -Recurse -Force -ErrorAction SilentlyContinue
}

# --- Case 2: single and double quotes mixed within the same additionalArguments -------
# Confirms the tokenizer correctly handles a mix of both quote styles across
# different tokens in the same invocation.
$fakeAzCopyDir2 = Join-Path $env:TEMP "msrc128417-singlequote-l0-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $fakeAzCopyDir2 -Force | Out-Null
$fakeAzCopyExe2 = Join-Path $fakeAzCopyDir2 'AzCopy.exe'
$argsCaptureFile2 = Join-Path $fakeAzCopyDir2 'captured-args.txt'
Add-Type -OutputType ConsoleApplication -OutputAssembly $fakeAzCopyExe2 -TypeDefinition @"
using System;
using System.IO;
public class FakeAzCopy2 {
    public static int Main(string[] args) {
        File.WriteAllLines(@"$argsCaptureFile2", args);
        return 0;
    }
}
"@

try {
    New-Item -ItemType File -Path $fakeResponseFile -Force | Out-Null

    Upload-FilesToAzureContainer -sourcePath 'C:\src' `
        -storageAccountName 'validstorage' `
        -containerName 'validcontainer' `
        -blobPrefix '' `
        -blobStorageEndpoint 'https://validstorage.blob.core.windows.net' `
        -storageKey 'validkey' `
        -azCopyLocation $fakeAzCopyDir2 `
        -additionalArguments "--include-pattern 'a b.txt' --exclude-pattern `"c d.txt`"" `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -useSanitizerActivate $false `
        -useSourcePathHardening $true

    Assert-IsNotNullOrEmpty (Test-Path $argsCaptureFile2) "Expected the fake AzCopy.exe to have been invoked and to have captured its argv."
    $capturedArgs2 = @(Get-Content -Path $argsCaptureFile2)

    $includePatternIndex = [array]::IndexOf($capturedArgs2, '--include-pattern')
    Assert-AreNotEqual -1 $includePatternIndex "Expected '--include-pattern' to be a captured argument. Captured argv: $($capturedArgs2 -join '|')"
    Assert-AreEqual 'a b.txt' $capturedArgs2[$includePatternIndex + 1] "A single-quoted value must survive as one intact argument with quotes stripped. Captured argv: $($capturedArgs2 -join '|')"

    $excludePatternIndex = [array]::IndexOf($capturedArgs2, '--exclude-pattern')
    Assert-AreNotEqual -1 $excludePatternIndex "Expected '--exclude-pattern' to be a captured argument. Captured argv: $($capturedArgs2 -join '|')"
    Assert-AreEqual 'c d.txt' $capturedArgs2[$excludePatternIndex + 1] "A double-quoted value must still survive as one intact argument with quotes stripped, alongside a single-quoted value in the same additionalArguments string. Captured argv: $($capturedArgs2 -join '|')"
}
finally {
    Remove-Item -Path $fakeAzCopyDir2 -Recurse -Force -ErrorAction SilentlyContinue
}

Remove-Item -Path $fakeResponseFile -Force -ErrorAction SilentlyContinue
