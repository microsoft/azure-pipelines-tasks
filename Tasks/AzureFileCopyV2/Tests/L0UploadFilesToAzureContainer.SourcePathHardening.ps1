[CmdletBinding()]
param()

# Regression / security test for MSRC 128417 (ICM 31000000667400).
#
# SourcePath can be bound to a queue-time pipeline parameter. Before the fix,
# Upload-FilesToAzureContainer always built the AzCopy command line as a
# string and executed it with Invoke-Expression, which re-parses the fully
# substituted string as new PowerShell source. Any PowerShell subexpression
# `$(...)` embedded in the (attacker-controlled) SourcePath value therefore
# executed with the task's privileges - e.g. exfiltrating
# $env:SYSTEM_ACCESSTOKEN / $env:AZCOPY_SPA_CLIENT_SECRET.
#
# The fix introduces the 'AzureFileCopy.EnableSourcePathHardening' pipeline
# feature (read via Get-VstsPipelineFeature).
# When enabled, the AzCopy invocation uses the call operator (&) with
# SourcePath passed as a literal argument value, which is never re-parsed as
# code and is therefore immune to this injection regardless of its content.
#
# This test proves the fix using the exact payload shape from the ICM repro:
# it embeds a subexpression that creates a marker file, then asserts the
# marker file is created when hardening is OFF (documents/guards the known
# legacy behavior) and is NOT created when hardening is ON (proves the fix).

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1

Register-Mock Write-Telemetry { }
# The response file lookup path is unrelated to this test; make it resolve to a real,
# already-existing temp file (rather than mocking Test-Path itself) so
# Upload-FilesToAzureContainer skips creating a real one without interfering with the
# Test-Path calls this test makes on the marker files below.
# Upload-FilesToAzureContainer deletes this file itself in its own finally block, so it
# must be recreated before each invocation of the function.
$fakeResponseFile = Join-Path $env:TEMP "msrc128417-l0-responsefile-$([guid]::NewGuid())"
Register-Mock Get-VstsTaskVariable { return $fakeResponseFile }

# Stand in for AzCopy.exe with a trivial, freshly compiled executable that
# ignores all its arguments, performs no side effects and always exits 0.
# This guarantees the test never launches a real copy/network operation and
# that any marker file is created (or not) purely as a result of how the
# command string is built/executed, not by AzCopy itself.
$fakeAzCopyDir = Join-Path $env:TEMP "msrc128417-l0-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $fakeAzCopyDir -Force | Out-Null
$fakeAzCopyExe = Join-Path $fakeAzCopyDir 'AzCopy.exe'
Add-Type -OutputType ConsoleApplication -OutputAssembly $fakeAzCopyExe -TypeDefinition 'public class FakeAzCopy { public static int Main(string[] args) { return 0; } }'

try {
    New-Item -ItemType File -Path $fakeResponseFile -Force | Out-Null

    # --- Case 1: hardening OFF (legacy/default behavior) --------------------
    # Documents the pre-fix behavior: the injected subexpression executes.
    $markerOff = Join-Path $env:TEMP "msrc128417-marker-off-$([guid]::NewGuid()).txt"
    # Note: no pipe/redirection characters in the payload - this version's
    # Upload-FilesToAzureContainer probes $sourcePath with a literal
    # Test-Path (Leaf) check before the vulnerable/hardened branch even
    # runs, and .NET's path validation rejects '|' as an illegal path
    # character regardless of hardening. New-Item's own default output is
    # harmless noise here, so it is left unsuppressed.
    $maliciousSourcePathOff = "C:\src`$(New-Item -Path '$markerOff' -ItemType File -Force)"

    Upload-FilesToAzureContainer -sourcePath $maliciousSourcePathOff `
        -storageAccountName 'validstorage' `
        -containerName 'validcontainer' `
        -blobPrefix '' `
        -blobStorageEndpoint 'https://validstorage.blob.core.windows.net' `
        -storageKey 'validkey' `
        -azCopyLocation $fakeAzCopyDir `
        -additionalArguments '' `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -useSanitizerActivate $false `
        -useSourcePathHardening $false

    Assert-AreEqual $true (Test-Path $markerOff) "Legacy path (hardening OFF): the injected subexpression was expected to execute via Invoke-Expression (documents pre-fix/known-vulnerable behavior)."

    New-Item -ItemType File -Path $fakeResponseFile -Force | Out-Null

    # --- Case 2: hardening ON (fixed behavior) ------------------------------
    # Proves the fix: the same payload shape must NOT execute.
    $markerOn = Join-Path $env:TEMP "msrc128417-marker-on-$([guid]::NewGuid()).txt"
    $maliciousSourcePathOn = "C:\src`$(New-Item -Path '$markerOn' -ItemType File -Force)"

    Upload-FilesToAzureContainer -sourcePath $maliciousSourcePathOn `
        -storageAccountName 'validstorage' `
        -containerName 'validcontainer' `
        -blobPrefix '' `
        -blobStorageEndpoint 'https://validstorage.blob.core.windows.net' `
        -storageKey 'validkey' `
        -azCopyLocation $fakeAzCopyDir `
        -additionalArguments '' `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -useSanitizerActivate $false `
        -useSourcePathHardening $true

    Assert-AreEqual $false (Test-Path $markerOn) "Hardened path (hardening ON): the injected subexpression must NOT execute (MSRC 128417 fix)."

    New-Item -ItemType File -Path $fakeResponseFile -Force | Out-Null

    # --- Case 3: hardening ON, sanitizer also ON ----------------------------
    # Confirms the hardened branch is used regardless of the pre-existing
    # sanitizer feature flag state.
    $markerOnSanitized = Join-Path $env:TEMP "msrc128417-marker-on-sanitized-$([guid]::NewGuid()).txt"
    $maliciousSourcePathOnSanitized = "C:\src`$(New-Item -Path '$markerOnSanitized' -ItemType File -Force)"

    Upload-FilesToAzureContainer -sourcePath $maliciousSourcePathOnSanitized `
        -storageAccountName 'validstorage' `
        -containerName 'validcontainer' `
        -blobPrefix '' `
        -blobStorageEndpoint 'https://validstorage.blob.core.windows.net' `
        -storageKey 'validkey' `
        -azCopyLocation $fakeAzCopyDir `
        -additionalArguments '' `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -useSanitizerActivate $true `
        -useSourcePathHardening $true

    Assert-AreEqual $false (Test-Path $markerOnSanitized) "Hardened path with sanitizer also ON: the injected subexpression must NOT execute (MSRC 128417 fix)."
}
finally {
    Remove-Item -Path $fakeAzCopyDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $fakeResponseFile -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $markerOff, $markerOn, $markerOnSanitized -Force -ErrorAction SilentlyContinue
}
