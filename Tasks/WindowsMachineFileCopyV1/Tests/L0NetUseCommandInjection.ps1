[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

Register-Mock Import-Module { }
Register-Mock Write-VstsTaskError { }
Register-Mock Write-VstsSetResult { }

. $PSScriptRoot\..\RoboCopyJob.ps1

function New-NoOpExe {
    param([string]$Path)
    Add-Type -TypeDefinition 'public static class NoOpProgram { public static int Main(string[] a) { return 0; } }' `
        -OutputAssembly $Path -OutputType ConsoleApplication
}

function New-ArgvRecorderExe {
    param([string]$Path)
    $source = @'
using System;
using System.IO;
public static class ArgvRecorder
{
    public static int Main(string[] args)
    {
        string outFile = Environment.GetEnvironmentVariable("WMFC_ARGV_RECORD_PATH");
        using (StreamWriter writer = new StreamWriter(outFile, true))
        {
            foreach (string a in args)
            {
                writer.WriteLine(a);
            }
            writer.WriteLine("---");
        }
        return 0;
    }
}
'@
    Add-Type -TypeDefinition $source -OutputAssembly $Path -OutputType ConsoleApplication
}

$fakeWindir = Join-Path $env:TEMP "wmfc-fakewindir-$([guid]::NewGuid().ToString('N'))"
$fakePathDir = Join-Path $env:TEMP "wmfc-fakepath-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Force -Path (Join-Path $fakeWindir 'system32'), $fakePathDir | Out-Null
New-ArgvRecorderExe -Path (Join-Path $fakeWindir 'system32\net.exe')
New-NoOpExe -Path (Join-Path $fakePathDir 'robocopy.exe')

$recordPath = Join-Path $env:TEMP "wmfc-argv-$([guid]::NewGuid().ToString('N')).txt"
if (Test-Path $recordPath) { Remove-Item $recordPath -Force }

$originalWindir = $env:windir
$originalPath = $env:PATH
$originalRecordPath = $env:WMFC_ARGV_RECORD_PATH
$env:windir = $fakeWindir
$env:PATH = "$fakePathDir;$originalPath"
$env:WMFC_ARGV_RECORD_PATH = $recordPath

$maliciousUserName = 'poc"; $global:injected = $true; #'
$credential = [PSCustomObject]@{ UserName = $maliciousUserName; Password = 'DummyPassword1!' }

try
{
    $global:injected = $false

    try {
        $CopyJob.Invoke(
            '',
            'C:\source\poc-source.txt',
            '\\FAKEHOST\share$\dest',
            $credential,
            'false',
            '',
            'false',
            $false,
            $PSScriptRoot,
            $false
        )
    } catch { }

    Assert-AreEqual $false $global:injected

    $recordedLines = @(Get-Content -LiteralPath $recordPath)
    $separatorIndex = [array]::IndexOf($recordedLines, '---')
    Assert-AreEqual $true ($separatorIndex -gt 0)
    $netUseArgs = $recordedLines[0..($separatorIndex - 1)]

    Assert-AreEqual 'use' $netUseArgs[0]
    Assert-AreEqual '\\FAKEHOST\share$\dest' $netUseArgs[1]
    Assert-AreEqual "/user:$maliciousUserName" $netUseArgs[2]
    Assert-AreEqual 'DummyPassword1!' $netUseArgs[3]

    Remove-Item $recordPath -Force -ErrorAction SilentlyContinue
    $global:injected = $false

    try {
        $CopyJob.Invoke(
            '',
            'C:\source\poc-source.txt',
            '\\FAKEHOST\share$\dest',
            $credential,
            'false',
            '',
            'false',
            $false,
            $PSScriptRoot,
            $true
        )
    } catch { }

    Assert-AreEqual $true $global:injected
}
finally
{
    $env:windir = $originalWindir
    $env:PATH = $originalPath
    $env:WMFC_ARGV_RECORD_PATH = $originalRecordPath

    Remove-Item $fakeWindir, $fakePathDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $recordPath -Force -ErrorAction SilentlyContinue
    Remove-Variable -Name injected -Scope Global -ErrorAction SilentlyContinue
}
