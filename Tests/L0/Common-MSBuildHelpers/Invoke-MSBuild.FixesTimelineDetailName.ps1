[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\..\..\Tasks\MSBuild\ps_modules\MSBuildHelpers -PassThru
$expectedMSBuildPath = "C:\Some msbuild dir\msbuild.exe"
$expectedLoggerPath = ([System.IO.Path]::GetFullPath("$PSScriptRoot\..\..\..\Tasks\MSBuild\ps_modules\MSBuildHelpers\Microsoft.TeamFoundation.DistributedTask.MSBuild.Logger.dll"))
Register-Mock Get-MSBuildPath { $expectedMSBuildPath }
Register-Mock Assert-VstsPath
Register-Mock Get-VstsTaskVariable { "C:\Some agent home directory" } -- -Name Agent.HomeDirectory -Require
Register-Mock Invoke-VstsTool {
        @(
            'Some first output'
            '##vso[task.logdetail id=1;name=C:\Some solution dir\Some project dir\Some project 1.csproj]Some project 1 data'
            '##vso[task.logdetail id=2;name=C:\Some other dir\Some project 2.csproj]Some project 2 data'
            '##vso[task.logdetail id=3;name=Some project 3.csproj]Some project 3 data'
            '##vso[task.logdetail id=4;name=Some project 4.csproj;targetnames=debug]Some project 4 data'
            'Some last output'
        )
    }
$global:LASTEXITCODE = 0
Register-Mock Write-VstsSetResult
Register-Mock Write-VstsLogDetail
Register-Mock Write-LoggingCommand -Func {
        "Detail name: $($args[1].Properties.Name)"
    } -ArgumentsEvaluator {
        $args.Count -eq 3 -and
            $args[0] -eq '-Command' -and
            $args[1].Area -eq 'task' -and
            $args[1].Event -eq 'logdetail' -and
            $args[2] -eq '-AsOutput'
    }
$expectedProjectFile = 'C:\Some solution dir\Some solution file.sln'

# Act.
$actual = & $module Invoke-MSBuild -ProjectFile $expectedProjectFile

# Assert.
Assert-WasCalled Assert-VstsPath -- -LiteralPath $expectedMSBuildPath -PathType Leaf
Assert-WasCalled Assert-VstsPath -- -LiteralPath $expectedLoggerPath -PathType Leaf
Assert-WasCalled Invoke-VstsTool -- -FileName $expectedMSBuildPath -Arguments "`"$expectedProjectFile`" /nologo /nr:false /dl:CentralLogger,`"$expectedLoggerPath`"*ForwardingLogger,`"$expectedLoggerPath`"" -RequireExitCodeZero
Assert-WasCalled Write-VstsSetResult -Times 0
Assert-AreEqual -Expected @(
    'Some first output'
    'Detail name: Some project dir\Some project 1.csproj'
    'Detail name: Some project 2.csproj'
    'Detail name: Some project 3.csproj'
    'Detail name: Some project 4.csproj (debug)'
    'Some last output'
) -Actual $actual
