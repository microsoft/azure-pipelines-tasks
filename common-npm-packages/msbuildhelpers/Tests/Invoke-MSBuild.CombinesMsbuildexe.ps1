[CmdletBinding()]
param()

$shouldUseInvokeProcess = [System.Convert]::ToBoolean($env:AZP_PS_ENABLE_INVOKE_PROCESS)

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\MSBuildHelpers.psm1 -PassThru
$env:msBuildDir = 'C:\Some msbuild dir'
$msBuildPath = "%msBuildDir%"
$expectedMSBuildPath = "C:\Some msbuild dir\msbuild.exe"
$expectedLoggerPath = ([System.IO.Path]::GetFullPath("$PSScriptRoot\..\tools\Microsoft.TeamFoundation.DistributedTask.MSBuild.Logger.dll"))
Register-Mock Assert-VstsPath
Register-Mock Get-VstsTaskVariable { "C:\Some agent home directory" } -- -Name Agent.HomeDirectory -Require
Register-Mock Invoke-VstsProcess { $global:LASTEXITCODE = 0; 'Some output 1', 'Some output 2' }
Register-Mock Invoke-VstsTool { $global:LASTEXITCODE = 0 ; 'Some output 1', 'Some output 2' }
Register-Mock Write-VstsSetResult

# Act.
$actual = & $module Invoke-MSBuild -ProjectFile 'Some project file' -NoTimelineLogger -MSBuildPath $msBuildPath

# Assert.
Assert-WasCalled Assert-VstsPath -- -LiteralPath $expectedMSBuildPath -PathType Leaf
Assert-WasCalled Assert-VstsPath -- -LiteralPath $expectedLoggerPath -PathType Leaf
if ($shouldUseInvokeProcess) {
    Assert-WasCalled Invoke-VstsProcess -- -FileName $expectedMSBuildPath -Arguments "`"Some project file`" /nologo /nr:false /dl:CentralLogger,`"$expectedLoggerPath`";`"RootDetailId=|SolutionDir=|enableOrphanedProjectsLogs=true`"*ForwardingLogger,`"$expectedLoggerPath`"" -RequireExitCodeZero
}
else {
    Assert-WasCalled Invoke-VstsTool -- -FileName $expectedMSBuildPath -Arguments "`"Some project file`" /nologo /nr:false /dl:CentralLogger,`"$expectedLoggerPath`";`"RootDetailId=|SolutionDir=|enableOrphanedProjectsLogs=true`"*ForwardingLogger,`"$expectedLoggerPath`"" -RequireExitCodeZero
}
Assert-WasCalled Write-VstsSetResult -Times 0
Assert-AreEqual -Expected @(
    'Some output 1'
    'Some output 2'
) -Actual $actual
