[CmdletBinding()]
param()

# Regression tests for PR #22786 review comments on the
# 'AzureFileCopy.AzCopySpnDirectAuthFixEnabled' direct-SPN-auth path in
# Upload-FilesToAzureContainer:
#
#   - discussion_r4478334935: with a sovereign/custom-cloud connection, the
#     direct-SPN-auth path must set AZCOPY_ACTIVE_DIRECTORY_ENDPOINT from the
#     endpoint's own authority (endpoint.Data.EnvironmentAuthorityUrl), not
#     silently default to public Azure - otherwise AzCopy authenticates
#     against the wrong AAD instance and an otherwise-valid connection fails.
#   - discussion_r4478334946: switching between certificate and client-secret
#     auth must clear the *other* credential's env vars, since AzCopy
#     prioritizes a leftover AZCOPY_SPA_CERT_PATH over a newly-set client
#     secret (and vice versa is not a risk, but is also covered here).
#   - Both comments also call out that the AzCopy SPN env vars must be
#     restored to their prior state once the call completes, so one
#     invocation's credentials/config never leak into the next.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\Common\ExternalOutputSanitizer\ExternalOutputSanitizer.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1

# Upload-FilesToAzureContainer's finally block always calls Import-Module
# (already globally mocked as a no-op by Initialize-Test.ps1) and
# Remove-EndpointSecrets. The real VstsAzureHelpers_ module is never actually
# imported in this unit test, so stub the function it would otherwise export.
function global:Remove-EndpointSecrets { }
function global:Write-Telemetry { param($area, $feature) }

# ConvertTo-Pfx shells out to openssl to convert a PEM blob to a PFX file,
# which is unnecessary and environment-dependent for this test; stub it with
# a fixed, recognizable path/password pair instead. Deliberately redefined
# without 'global:' and in this same scope (not as a nested/child scope),
# since Utility.ps1 was just dot-sourced into this very scope above:
# Upload-FilesToAzureContainer resolves ConvertTo-Pfx from this scope first,
# so a same-scope redefinition reliably shadows Utility.ps1's original
# regardless of whether this file itself is dot-sourced directly or invoked
# by a test runner (e.g. Pester) that nests scopes differently.
function ConvertTo-Pfx {
    param([string]$pemFileContent)
    return @('C:\fake\clientcertificate.pfx', 'fake-pfx-password')
}

$script:azCopySpnDirectAuthFixEnabled = $true

# Stand in for AzCopy.exe with a freshly compiled executable that, instead of
# performing any real copy/network operation, captures the subset of
# environment variables AzCopy itself would have read (i.e. the state as of
# the moment this invocation actually runs, before the function's finally
# block restores the pre-call snapshot) to a file so the test can assert on
# it, then exits 0.
$fakeAzCopyDir = Join-Path $env:TEMP "afc-spn-l0-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $fakeAzCopyDir -Force | Out-Null
$fakeAzCopyExe = Join-Path $fakeAzCopyDir 'AzCopy.exe'
$capturedEnvPath = Join-Path $fakeAzCopyDir 'captured-env.json'
$fakeAzCopySource = @"
using System;
using System.Collections.Generic;
using System.IO;
public class FakeAzCopy {
    public static int Main(string[] args) {
        string[] names = {
            "AZCOPY_ACTIVE_DIRECTORY_ENDPOINT",
            "AZCOPY_AUTO_LOGIN_TYPE",
            "AZCOPY_TENANT_ID",
            "AZCOPY_SPA_APPLICATION_ID",
            "AZCOPY_SPA_CERT_PATH",
            "AZCOPY_SPA_CERT_PASSWORD",
            "AZCOPY_SPA_CLIENT_SECRET"
        };
        var lines = new List<string>();
        foreach (var name in names) {
            var value = Environment.GetEnvironmentVariable(name) ?? "";
            lines.Add(name + "=" + value);
        }
        File.WriteAllLines(@"$capturedEnvPath", lines.ToArray());
        return 0;
    }
}
"@
Add-Type -OutputType ConsoleApplication -OutputAssembly $fakeAzCopyExe -TypeDefinition $fakeAzCopySource

function Get-CapturedAzCopyEnvVar {
    param([string]$Name)
    $line = Get-Content -Path $capturedEnvPath | Where-Object { $_ -like "$Name=*" }
    return $line.Substring($Name.Length + 1)
}

$sovereignAuthorityUrl = 'https://login.chinacloudapi.cn/'

$azCopySpnEnvVarNames = @(
    'AZCOPY_ACTIVE_DIRECTORY_ENDPOINT',
    'AZCOPY_AUTO_LOGIN_TYPE',
    'AZCOPY_TENANT_ID',
    'AZCOPY_SPA_APPLICATION_ID',
    'AZCOPY_SPA_CERT_PATH',
    'AZCOPY_SPA_CERT_PASSWORD',
    'AZCOPY_SPA_CLIENT_SECRET'
)

function Clear-AzCopySpnEnvVars {
    foreach ($envVarName in $azCopySpnEnvVarNames) {
        Remove-Item -Path "Env:\$envVarName" -ErrorAction SilentlyContinue
    }
}

try {
    # --- Case 1: certificate auth against a sovereign/custom cloud ----------
    # AZCOPY_ACTIVE_DIRECTORY_ENDPOINT must come from the endpoint's own
    # EnvironmentAuthorityUrl, and any leftover client secret from a prior
    # key-auth run must be cleared.
    Clear-AzCopySpnEnvVars
    $env:AZCOPY_SPA_CLIENT_SECRET = 'leftover-secret-from-prior-run'

    $certEndPoint = New-Object -TypeName psobject -Property @{
        Auth = New-Object -TypeName psobject -Property @{
            Scheme     = 'ServicePrincipal'
            Parameters = @{
                AuthenticationType       = 'SPNCertificate'
                TenantId                 = 'sovereign-tenant-id'
                ServicePrincipalId       = 'sovereign-app-id'
                ServicePrincipalCertificate = 'fake-pem-content'
            }
        }
        Data = @{ EnvironmentAuthorityUrl = $sovereignAuthorityUrl }
    }

    Upload-FilesToAzureContainer -sourcePath 'C:\src' `
        -endPoint $certEndPoint `
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

    # Assert against the environment AzCopy itself actually saw (captured by
    # the fake exe), since the function's finally block restores the pre-call
    # snapshot (here: the 'leftover-secret-from-prior-run' value) once it
    # returns - that restore is a deliberate, separate requirement (asserted
    # below) and must not be confused with the mid-call clearing requirement.
    Assert-AreEqual $sovereignAuthorityUrl (Get-CapturedAzCopyEnvVar 'AZCOPY_ACTIVE_DIRECTORY_ENDPOINT') "Certificate auth against a sovereign/custom cloud: AZCOPY_ACTIVE_DIRECTORY_ENDPOINT must be set from the endpoint's own EnvironmentAuthorityUrl, not default to public Azure."
    Assert-AreEqual '' (Get-CapturedAzCopyEnvVar 'AZCOPY_SPA_CLIENT_SECRET') "Certificate auth: a leftover client secret from a prior key-auth run must be cleared for the duration of this call, since AzCopy would otherwise prioritize the client secret over the certificate."

    # Snapshot/restore runs in the function's finally block, so by the time
    # Upload-FilesToAzureContainer returns, all SPN env vars are back to
    # their pre-call state (here: AZCOPY_SPA_CLIENT_SECRET = the leftover
    # value that existed before this call, everything else unset) - this
    # directly proves the comments' "restore the previous environment
    # afterward" requirement.
    Assert-AreEqual 'leftover-secret-from-prior-run' $env:AZCOPY_SPA_CLIENT_SECRET "Certificate auth: AZCOPY_SPA_CLIENT_SECRET must be restored to its pre-call state after Upload-FilesToAzureContainer returns."
    foreach ($envVarName in ($azCopySpnEnvVarNames | Where-Object { $_ -ne 'AZCOPY_SPA_CLIENT_SECRET' })) {
        Assert-AreEqual $null ([System.Environment]::GetEnvironmentVariable($envVarName)) "Certificate auth: $envVarName must be restored to its pre-call (unset) state after Upload-FilesToAzureContainer returns."
    }

    # --- Case 2: client-secret auth against a sovereign/custom cloud --------
    # AZCOPY_ACTIVE_DIRECTORY_ENDPOINT must again come from the endpoint's own
    # authority, and any leftover certificate path/password from a prior
    # cert-auth run must be cleared.
    Clear-AzCopySpnEnvVars
    $env:AZCOPY_SPA_CERT_PATH = 'C:\leftover\clientcertificate.pfx'
    $env:AZCOPY_SPA_CERT_PASSWORD = 'leftover-pfx-password'

    $secretEndPoint = New-Object -TypeName psobject -Property @{
        Auth = New-Object -TypeName psobject -Property @{
            Scheme     = 'ServicePrincipal'
            Parameters = @{
                AuthenticationType = 'SPNKey'
                TenantId           = 'sovereign-tenant-id'
                ServicePrincipalId = 'sovereign-app-id'
                ServicePrincipalKey = 'fake-client-secret'
            }
        }
        Data = @{ EnvironmentAuthorityUrl = $sovereignAuthorityUrl }
    }

    Upload-FilesToAzureContainer -sourcePath 'C:\src' `
        -endPoint $secretEndPoint `
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

    Assert-AreEqual $sovereignAuthorityUrl (Get-CapturedAzCopyEnvVar 'AZCOPY_ACTIVE_DIRECTORY_ENDPOINT') "Client-secret auth against a sovereign/custom cloud: AZCOPY_ACTIVE_DIRECTORY_ENDPOINT must be set from the endpoint's own EnvironmentAuthorityUrl, not default to public Azure."
    Assert-AreEqual '' (Get-CapturedAzCopyEnvVar 'AZCOPY_SPA_CERT_PATH') "Client-secret auth: a leftover certificate path from a prior cert-auth run must be cleared for the duration of this call, since AzCopy would otherwise prioritize the certificate over the client secret."
    Assert-AreEqual '' (Get-CapturedAzCopyEnvVar 'AZCOPY_SPA_CERT_PASSWORD') "Client-secret auth: a leftover certificate password from a prior cert-auth run must be cleared for the duration of this call."

    Assert-AreEqual 'C:\leftover\clientcertificate.pfx' $env:AZCOPY_SPA_CERT_PATH "Client-secret auth: AZCOPY_SPA_CERT_PATH must be restored to its pre-call state after Upload-FilesToAzureContainer returns."
    Assert-AreEqual 'leftover-pfx-password' $env:AZCOPY_SPA_CERT_PASSWORD "Client-secret auth: AZCOPY_SPA_CERT_PASSWORD must be restored to its pre-call state after Upload-FilesToAzureContainer returns."
    foreach ($envVarName in ($azCopySpnEnvVarNames | Where-Object { $_ -notin @('AZCOPY_SPA_CERT_PATH', 'AZCOPY_SPA_CERT_PASSWORD') })) {
        Assert-AreEqual $null ([System.Environment]::GetEnvironmentVariable($envVarName)) "Client-secret auth: $envVarName must be restored to its pre-call (unset) state after Upload-FilesToAzureContainer returns."
    }
}
finally {
    Clear-AzCopySpnEnvVars
    Remove-Item -Path $fakeAzCopyDir -Recurse -Force -ErrorAction SilentlyContinue
}
