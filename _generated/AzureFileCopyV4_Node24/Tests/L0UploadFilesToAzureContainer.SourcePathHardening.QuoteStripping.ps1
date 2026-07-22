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
. $PSScriptRoot\..\Utility.ps1

# Upload-FilesToAzureContainer's finally block always calls Import-Module
# (already globally mocked as a no-op by Initialize-Test.ps1) and
# Remove-EndpointSecrets. The real VstsAzureHelpers_ module is never actually
# imported in this unit test, so stub the function it would otherwise export.
function global:Remove-EndpointSecrets { }
function global:Write-Telemetry { param($area, $feature) }

$endPoint = New-Object -TypeName psobject -Property @{
    Auth = New-Object -TypeName psobject -Property @{ Scheme = 'ManagedServiceIdentity'; Parameters = @{} }
    Data = @{ EnvironmentAuthorityUrl = $null }
}

# Stand in for AzCopy.exe with a trivial, freshly compiled executable that
# records the exact argv it receives (one line per argument) so the test can
# assert on what the hardened call-operator path actually passes to a real
# native process, without performing any real copy/network operation.
# Upload-FilesToAzureContainer invokes AzCopy multiple times (login, copy,
# logout), so each invocation's argv is captured to a file named after its
# first argument (the AzCopy subcommand) rather than a single shared file,
# to avoid the copy invocation's captured argv being overwritten by the
# subsequent logout call.
$fakeAzCopyDir = Join-Path $env:TEMP "msrc128417-quoting-l0-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $fakeAzCopyDir -Force | Out-Null
$fakeAzCopyExe = Join-Path $fakeAzCopyDir 'AzCopy.exe'
$copyArgsCaptureFile = Join-Path $fakeAzCopyDir 'captured-args-copy.txt'
Add-Type -OutputType ConsoleApplication -OutputAssembly $fakeAzCopyExe -TypeDefinition @"
using System;
using System.IO;
public class FakeAzCopy {
    public static int Main(string[] args) {
        if (args.Length > 0) {
            File.WriteAllLines(@"$fakeAzCopyDir\captured-args-" + args[0] + ".txt", args);
        }
        return 0;
    }
}
"@

try {
    # This version's login block (ServicePrincipal/ManagedServiceIdentity) references
    # $azCopyExeLocation before the function's own local assignment runs; in the real
    # task this resolves via PowerShell's scope lookup to the value set by the calling
    # AzureFileCopy.ps1 script. Set it here at script scope so the same lookup finds our
    # fake AzCopy.exe when the function is invoked directly, outside that call chain.
    $azCopyExeLocation = $fakeAzCopyExe

    Upload-FilesToAzureContainer -sourcePath 'C:\src' `
        -endPoint $endPoint `
        -storageAccountName 'validstorage' `
        -containerName 'validcontainer' `
        -blobPrefix '' `
        -blobStorageEndpoint 'https://validstorage.blob.core.windows.net' `
        -azCopyLocation $fakeAzCopyDir `
        -additionalArguments '--include-pattern "sub folder\a.txt" --cap-mbps 500' `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -useSanitizerActivate $false `
        -useSourcePathHardening $true

    Assert-IsNotNullOrEmpty (Test-Path $copyArgsCaptureFile) "Expected the fake AzCopy.exe 'copy' invocation to have been captured."
    $capturedArgs = @(Get-Content -Path $copyArgsCaptureFile)

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
Add-Type -OutputType ConsoleApplication -OutputAssembly $fakeAzCopyExe2 -TypeDefinition @"
using System;
using System.IO;
public class FakeAzCopy2 {
    public static int Main(string[] args) {
        if (args.Length > 0) {
            File.WriteAllLines(@"$fakeAzCopyDir2\captured-args-" + args[0] + ".txt", args);
        }
        return 0;
    }
}
"@

try {
    $azCopyExeLocation = $fakeAzCopyExe2

    Upload-FilesToAzureContainer -sourcePath 'C:\src' `
        -endPoint $endPoint `
        -storageAccountName 'validstorage' `
        -containerName 'validcontainer' `
        -blobPrefix '' `
        -blobStorageEndpoint 'https://validstorage.blob.core.windows.net' `
        -azCopyLocation $fakeAzCopyDir2 `
        -additionalArguments '--path="C:\my folder\test.txt"' `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -useSanitizerActivate $false `
        -useSourcePathHardening $true

    $copyArgsCaptureFile2Path = Join-Path $fakeAzCopyDir2 'captured-args-copy.txt'
    Assert-IsNotNullOrEmpty (Test-Path $copyArgsCaptureFile2Path) "Expected the fake AzCopy.exe 'copy' invocation to have been captured."
    $capturedArgs2 = @(Get-Content -Path $copyArgsCaptureFile2Path)

    Assert-AreEqual $true ($capturedArgs2 -contains '--path=C:\my folder\test.txt') "A single-token additionalArguments value with a quote pair mid-token must be passed as one intact argument with the quotes stripped, matching legacy Invoke-Expression behavior. Captured argv: $($capturedArgs2 -join '|')"
}
finally {
    Remove-Item -Path $fakeAzCopyDir2 -Recurse -Force -ErrorAction SilentlyContinue
}
