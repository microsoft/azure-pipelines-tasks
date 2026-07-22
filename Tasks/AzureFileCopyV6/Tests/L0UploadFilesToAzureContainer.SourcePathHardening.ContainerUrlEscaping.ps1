[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Utility.ps1

function global:Remove-EndpointSecrets { }
function global:Write-Telemetry { param($area, $feature) }

$endPoint = New-Object -TypeName psobject -Property @{
    Auth = New-Object -TypeName psobject -Property @{ Scheme = 'ManagedServiceIdentity'; Parameters = @{} }
    Data = @{ EnvironmentAuthorityUrl = $null }
}

$fakeAzCopyDir = Join-Path $env:TEMP "msrc128417-containerurl-l0-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $fakeAzCopyDir -Force | Out-Null
$fakeAzCopyExe = Join-Path $fakeAzCopyDir 'AzCopy.exe'
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
    Upload-FilesToAzureContainer -sourcePath 'C:\src' `
        -endPoint $endPoint `
        -storageAccountName 'validstorage' `
        -containerName 'validcontainer' `
        -blobPrefix 'sub$folder' `
        -blobStorageEndpoint 'https://validstorage.blob.core.windows.net' `
        -azCopyLocation $fakeAzCopyDir `
        -additionalArguments '' `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -cleanTargetBeforeCopy $true `
        -useSanitizerActivate $false `
        -useSourcePathHardening $true

    $copyArgsCaptureFile = Join-Path $fakeAzCopyDir 'captured-args-copy.txt'
    Assert-IsNotNullOrEmpty (Test-Path $copyArgsCaptureFile) "Expected the fake AzCopy.exe 'copy' invocation to have been captured."
    $copyArgs = @(Get-Content -Path $copyArgsCaptureFile)
    $copyContainerURL = $copyArgs[2]

    Assert-AreEqual $false ($copyContainerURL.Contains('`')) "Hardened path passes containerURL as a literal call-operator argument (never re-parsed), so it must not be escaped with a backtick; found one in: $copyContainerURL"
    Assert-AreEqual $true ($copyContainerURL.Contains('sub$folder')) "Expected the literal blobPrefix 'sub`$folder' to survive unescaped in the containerURL argument passed to AzCopy.exe: $copyContainerURL"

    $rmArgsCaptureFile = Join-Path $fakeAzCopyDir 'captured-args-rm.txt'
    Assert-IsNotNullOrEmpty (Test-Path $rmArgsCaptureFile) "Expected the fake AzCopy.exe 'rm' invocation (cleanTargetBeforeCopy) to have been captured."
    $rmArgs = @(Get-Content -Path $rmArgsCaptureFile)
    $rmContainerURL = $rmArgs[1]

    Assert-AreEqual $false ($rmContainerURL.Contains('`')) "Hardened cleanTargetBeforeCopy path passes containerURL as a literal call-operator argument, so it must not be escaped with a backtick; found one in: $rmContainerURL"
    Assert-AreEqual $true ($rmContainerURL.Contains('sub$folder')) "Expected the literal blobPrefix 'sub`$folder' to survive unescaped in the containerURL argument passed to AzCopy.exe: $rmContainerURL"
}
finally {
    Remove-Item -Path $fakeAzCopyDir -Recurse -Force -ErrorAction SilentlyContinue
}
