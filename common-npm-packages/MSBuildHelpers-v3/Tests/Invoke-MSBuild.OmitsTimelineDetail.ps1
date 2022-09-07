[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru
$expectedMSBuildPath = "C:\Some msbuild dir\msbuild.exe"
$expectedLoggerPath = ([System.IO.Path]::GetFullPath("$PSScriptRoot\..\Microsoft.TeamFoundation.DistributedTask.MSBuild.Logger.dll"))
Register-Mock Get-MSBuildPath { $expectedMSBuildPath }
Register-Mock Assert-VstsPath
Register-Mock Get-VstsTaskVariable { "C:\Some agent home directory" } -- -Name Agent.HomeDirectory -Require
Register-Mock Invoke-VstsTool { $global:LASTEXITCODE = 0 ; 'Some output 1' ; 'Some output 2' }
Register-Mock Write-VstsSetResult
Register-Mock Write-VstsLogDetail
$expectedProjectFile = 'C:\Some solution dir\Some solution file.sln'

# Act.
$actual = & $module Invoke-MSBuild -ProjectFile $expectedProjectFile -NoTimelineLogger

# Assert.
Assert-WasCalled Assert-VstsPath -- -LiteralPath $expectedMSBuildPath -PathType Leaf
Assert-WasCalled Assert-VstsPath -- -LiteralPath $expectedLoggerPath -PathType Leaf
Assert-WasCalled Invoke-VstsTool -- -FileName $expectedMSBuildPath -Arguments "`"$expectedProjectFile`" /nologo /nr:false /dl:CentralLogger,`"$expectedLoggerPath`";`"RootDetailId=|SolutionDir=C:\Some solution dir|enableOrphanedProjectsLogs=true`"*ForwardingLogger,`"$expectedLoggerPath`"" -RequireExitCodeZero
Assert-WasCalled Write-VstsSetResult -Times 0
Assert-AreEqual -Expected @(
        'Some output 1'
        'Some output 2'
    ) -Actual $actual
Assert-WasCalled Write-VstsLogDetail -Times 0
