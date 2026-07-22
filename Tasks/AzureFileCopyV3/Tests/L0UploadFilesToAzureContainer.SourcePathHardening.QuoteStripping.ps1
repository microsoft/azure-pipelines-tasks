[CmdletBinding()]
param()

# Regression test for a follow-up correctness bug found in the MSRC 128417
# SourcePath hardening fix (see L0UploadFilesToAzureContainer.SourcePathHardening.ps1).
#
# Before this fix, the hardened path split $additionalArguments into tokens
# with a regex (to satisfy the call operator, which - unlike Invoke-Expression -
# requires arguments as discrete array elements) but never stripped the quote
# characters used purely to protect embedded spaces from being treated as a
# token boundary. Legacy Invoke-Expression re-parsed the whole command string
# as PowerShell source, so its own tokenizer stripped such quotes as string
# literal syntax. The call operator never re-parses strings, so any token that
# was quoted in additionalArguments (e.g. --include-pattern "sub folder\a.txt")
# reached AzCopy.exe with the literal quote characters still embedded in the
# value, corrupting paths/patterns containing spaces.
#
# This test proves the fix by capturing the real argv a native process
# receives from the hardened call-operator invocation and asserting the
# quote characters are gone while the token boundaries/values are preserved.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1

Register-Mock Write-Telemetry { }
# The response file lookup path is unrelated to this test; make it resolve to a real,
# already-existing temp file (rather than mocking Test-Path itself) so
# Upload-FilesToAzureContainer skips creating a real one without interfering with the
# Test-Path calls this test makes on the AzCopy.exe argv capture files below.
# Upload-FilesToAzureContainer deletes this file itself in its own finally block, so it
# must be recreated before each invocation of the function.
$fakeResponseFile = Join-Path $env:TEMP "msrc128417-quoting-l0-responsefile-$([guid]::NewGuid())"
Register-Mock Get-VstsTaskVariable { return $fakeResponseFile }

# Stand in for AzCopy.exe with a trivial, freshly compiled executable that
# records the exact argv it receives (one line per argument) so the test can
# assert on what the hardened call-operator path actually passes to a real
# native process, without performing any real copy/network operation. This
# version's Upload-FilesToAzureContainer invokes AzCopy exactly once (no
# separate login/logout calls), so a single capture file is sufficient.
$fakeAzCopyDir = Join-Path $env:TEMP "msrc128417-quoting-l0-$([guid]::NewGuid())"
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
        -additionalArguments '--include-pattern "sub folder\a.txt" --cap-mbps 500' `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -useSanitizerActivate $false `
        -useSourcePathHardening $true

    Assert-IsNotNullOrEmpty (Test-Path $argsCaptureFile) "Expected the fake AzCopy.exe to have been invoked and to have captured its argv."
    $capturedArgs = @(Get-Content -Path $argsCaptureFile)

    Assert-AreEqual $false (($capturedArgs -join '|').Contains('"')) "Hardened path must strip quote characters from split additionalArguments tokens before invoking AzCopy.exe; found a literal quote in the captured argv: $($capturedArgs -join '|')"

    $includePatternIndex = [array]::IndexOf($capturedArgs, '--include-pattern')
    Assert-AreNotEqual -1 $includePatternIndex "Expected '--include-pattern' to be a captured argument. Captured argv: $($capturedArgs -join '|')"
    Assert-AreEqual 'sub folder\a.txt' $capturedArgs[$includePatternIndex + 1] "The quoted value must be passed as a single argument with the quote characters stripped (matching legacy Invoke-Expression behavior), not split on the embedded space and not left with literal quote characters."

    Assert-AreEqual $true ($capturedArgs -contains '--cap-mbps') "Expected '--cap-mbps' to be a captured argument. Captured argv: $($capturedArgs -join '|')"
    Assert-AreEqual $true ($capturedArgs -contains '500') "Expected '500' to be a captured argument. Captured argv: $($capturedArgs -join '|')"
}
finally {
    Remove-Item -Path $fakeAzCopyDir -Recurse -Force -ErrorAction SilentlyContinue
}

# --- Case 2: additionalArguments containing exactly one token, quoted mid-token --------
# Also guards against a second-order bug: when the token-split pipeline yields only a
# single element, PowerShell can unwrap it to a plain string instead of a one-item array;
# splatting a string with @splitArguments would then explode it into individual
# characters as separate arguments to AzCopy.exe. This case (single '--path="..."' token)
# exercises exactly that scenario, in addition to confirming a quote pair embedded
# mid-token (after 'key=') is stripped like Invoke-Expression's own parsing did.
$fakeAzCopyDir2 = Join-Path $env:TEMP "msrc128417-quoting-l0-$([guid]::NewGuid())"
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
        -additionalArguments '--path="C:\my folder\test.txt"' `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -useSanitizerActivate $false `
        -useSourcePathHardening $true

    Assert-IsNotNullOrEmpty (Test-Path $argsCaptureFile2) "Expected the fake AzCopy.exe to have been invoked and to have captured its argv."
    $capturedArgs2 = @(Get-Content -Path $argsCaptureFile2)

    Assert-AreEqual $true ($capturedArgs2 -contains '--path=C:\my folder\test.txt') "A single-token additionalArguments value with a quote pair mid-token must be passed as one intact argument with the quotes stripped, matching legacy Invoke-Expression behavior. Captured argv: $($capturedArgs2 -join '|')"
}
finally {
    Remove-Item -Path $fakeAzCopyDir2 -Recurse -Force -ErrorAction SilentlyContinue
}

Remove-Item -Path $fakeResponseFile -Force -ErrorAction SilentlyContinue
