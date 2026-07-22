[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1

Register-Mock Write-Telemetry { }
$fakeResponseFile = Join-Path $env:TEMP "msrc128417-containerurl-l0-responsefile-$([guid]::NewGuid())"
Register-Mock Get-VstsTaskVariable { return $fakeResponseFile }

$fakeAzCopyDir = Join-Path $env:TEMP "msrc128417-containerurl-l0-$([guid]::NewGuid())"
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
        -blobPrefix 'sub$folder' `
        -blobStorageEndpoint 'https://validstorage.blob.core.windows.net' `
        -storageKey 'validkey' `
        -azCopyLocation $fakeAzCopyDir `
        -additionalArguments '' `
        -destinationType 'AzureBlob' `
        -useDefaultArguments $false `
        -useSanitizerActivate $false `
        -useSourcePathHardening $true

    Assert-IsNotNullOrEmpty (Test-Path $argsCaptureFile) "Expected the fake AzCopy.exe to have been invoked and to have captured its argv."
    $capturedArgs = @(Get-Content -Path $argsCaptureFile)
    $destArg = $capturedArgs | Where-Object { $_.StartsWith('/Dest:') } | Select-Object -First 1

    Assert-IsNotNullOrEmpty $destArg "Expected a '/Dest:' argument in the captured argv: $($capturedArgs -join '|')"
    Assert-AreEqual $false ($destArg.Contains('`')) "Hardened path passes containerURL as a literal call-operator argument (never re-parsed), so it must not be escaped with a backtick; found one in: $destArg"
    Assert-AreEqual $true ($destArg.Contains('sub$folder')) "Expected the literal blobPrefix 'sub`$folder' to survive unescaped in the /Dest: argument passed to AzCopy.exe: $destArg"
}
finally {
    Remove-Item -Path $fakeAzCopyDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $fakeResponseFile -Force -ErrorAction SilentlyContinue
}
