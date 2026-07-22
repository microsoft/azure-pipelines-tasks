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
# ignores all its arguments, performs no side effects and always exits 0.
# This guarantees the test never launches a real copy/network operation and
# that any marker file is created (or not) purely as a result of how the
# command string is built/executed, not by AzCopy itself.
$fakeAzCopyDir = Join-Path $env:TEMP "msrc128417-l0-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $fakeAzCopyDir -Force | Out-Null
$fakeAzCopyExe = Join-Path $fakeAzCopyDir 'AzCopy.exe'
Add-Type -OutputType ConsoleApplication -OutputAssembly $fakeAzCopyExe -TypeDefinition 'public class FakeAzCopy { public static int Main(string[] args) { return 0; } }'

try {
    # --- Case 1: hardening OFF (legacy/default behavior) --------------------
    # Documents the pre-fix behavior: the injected subexpression executes.
    $markerOff = Join-Path $env:TEMP "msrc128417-marker-off-$([guid]::NewGuid()).txt"
    $maliciousSourcePathOff = "C:\src`$(New-Item -Path '$markerOff' -ItemType File -Force | Out-Null)"

    Upload-FilesToAzureContainer -sourcePath $maliciousSourcePathOff `
        -endPoint $endPoint `
        -storageAccountName 'validstorage' `
        -containerName 'validcontainer' `
        -blobPrefix '' `
        -blobStorageEndpoint 'https://validstorage.blob.core.windows.net' `
        -azCopyLocation $fakeAzCopyDir `
        -additionalArguments '' `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -cleanTargetBeforeCopy $false `
        -useSanitizerActivate $false `
        -useSourcePathHardening $false

    Assert-AreEqual $true (Test-Path $markerOff) "Legacy path (hardening OFF): the injected subexpression was expected to execute via Invoke-Expression (documents pre-fix/known-vulnerable behavior)."

    # --- Case 2: hardening ON (fixed behavior) ------------------------------
    # Proves the fix: the same payload shape must NOT execute.
    $markerOn = Join-Path $env:TEMP "msrc128417-marker-on-$([guid]::NewGuid()).txt"
    $maliciousSourcePathOn = "C:\src`$(New-Item -Path '$markerOn' -ItemType File -Force | Out-Null)"

    Upload-FilesToAzureContainer -sourcePath $maliciousSourcePathOn `
        -endPoint $endPoint `
        -storageAccountName 'validstorage' `
        -containerName 'validcontainer' `
        -blobPrefix '' `
        -blobStorageEndpoint 'https://validstorage.blob.core.windows.net' `
        -azCopyLocation $fakeAzCopyDir `
        -additionalArguments '' `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -cleanTargetBeforeCopy $false `
        -useSanitizerActivate $false `
        -useSourcePathHardening $true

    Assert-AreEqual $false (Test-Path $markerOn) "Hardened path (hardening ON): the injected subexpression must NOT execute (MSRC 128417 fix)."

    # --- Case 3: hardening ON, sanitizer also ON ----------------------------
    # Confirms the hardened branch is used regardless of the pre-existing
    # sanitizer feature flag state.
    $markerOnSanitized = Join-Path $env:TEMP "msrc128417-marker-on-sanitized-$([guid]::NewGuid()).txt"
    $maliciousSourcePathOnSanitized = "C:\src`$(New-Item -Path '$markerOnSanitized' -ItemType File -Force | Out-Null)"

    Upload-FilesToAzureContainer -sourcePath $maliciousSourcePathOnSanitized `
        -endPoint $endPoint `
        -storageAccountName 'validstorage' `
        -containerName 'validcontainer' `
        -blobPrefix '' `
        -blobStorageEndpoint 'https://validstorage.blob.core.windows.net' `
        -azCopyLocation $fakeAzCopyDir `
        -additionalArguments '' `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -cleanTargetBeforeCopy $false `
        -useSanitizerActivate $true `
        -useSourcePathHardening $true

    Assert-AreEqual $false (Test-Path $markerOnSanitized) "Hardened path with sanitizer also ON: the injected subexpression must NOT execute (MSRC 128417 fix)."
}
finally {
    Remove-Item -Path $fakeAzCopyDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $markerOff, $markerOn, $markerOnSanitized -Force -ErrorAction SilentlyContinue
}
