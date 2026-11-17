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

$trickyUserName = 'CONTOSO\o"neil test\'
$trickyPassword = 'p@ss"word with spaces\'
$credential = [pscustomobject]@{ UserName = $trickyUserName; Password = $trickyPassword }

$source = Join-Path $env:TEMP "wmfc-source-$([guid]::NewGuid().ToString('N'))"
$target = Join-Path $env:TEMP "wmfc-target-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Force -Path $source, $target | Out-Null
'hello' | Set-Content (Join-Path $source 'file.txt')

try {
    & $CopyJob -fqdn 'testhost.example.com' -sourcePath $source -targetPath $target -credential $credential `
        -cleanTargetBeforeCopy 'false' -additionalArguments '' -useSanitizerActivate 'false' `
        -enableWindowsMachineFileCopyArgumentsHardening $false -scriptRoot "$PSScriptRoot\.." `
        -enableLegacyWindowsMachineFileCopyNetUseCommand $false
} catch {
}

$env:windir = $originalWindir
$env:PATH = $originalPath
$env:WMFC_ARGV_RECORD_PATH = $originalRecordPath

try {
    Assert-AreEqual $true (Test-Path $recordPath)
    $recordedLines = @(Get-Content -LiteralPath $recordPath)
    $separatorIndex = [array]::IndexOf($recordedLines, '---')

    Assert-AreEqual $true ($separatorIndex -gt 0)
    $mapArgs = $recordedLines[0..($separatorIndex - 1)]

    Assert-AreEqual 'use' $mapArgs[0]
    Assert-AreEqual "\\testhost.example.com" $mapArgs[1]
    Assert-AreEqual "/user:$trickyUserName" $mapArgs[2]
    Assert-AreEqual $trickyPassword $mapArgs[3]
    Assert-AreEqual 4 $mapArgs.Count

    $deleteArgs = $recordedLines[($separatorIndex + 1)..($recordedLines.Count - 1)] | Where-Object { $_ -ne '---' -and $_ -ne '' }
    Assert-AreEqual 'use' $deleteArgs[0]
    Assert-AreEqual "\\testhost.example.com" $deleteArgs[1]
    Assert-AreEqual '/D' $deleteArgs[2]
    Assert-AreEqual '/Y' $deleteArgs[3]
}
finally {
    Remove-Item $source, $target -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $fakeWindir, $fakePathDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $recordPath -Force -ErrorAction SilentlyContinue
}
