[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\..\..\Tasks\MSBuild\ps_modules\MSBuildHelpers -PassThru
$env:msBuildDir = 'C:\Some msbuild dir'
$msBuildPath = "%msBuildDir%"
$expectedMSBuildPath = "C:\Some msbuild dir\msbuild.exe"
Register-Mock Assert-VstsPath
Register-Mock Get-VstsTaskVariable { "C:\Some agent home directory" } -- -Name Agent.HomeDirectory -Require
Register-Mock Invoke-VstsTool { 'Some output 1', 'Some output 2' }
$global:LASTEXITCODE = 0
Register-Mock Write-VstsSetResult

# Act.
$actual = & $module Invoke-MSBuild -ProjectFile 'Some project file' -NoTimelineLogger -MSBuildPath $msBuildPath

# Assert.
Assert-WasCalled Assert-VstsPath -- -LiteralPath $expectedMSBuildPath -PathType Leaf
Assert-WasCalled Assert-VstsPath -- -LiteralPath "C:\Some agent home directory\Agent\Worker\Microsoft.TeamFoundation.DistributedTask.MSBuild.Logger.dll" -PathType Leaf
Assert-WasCalled Invoke-VstsTool -- -FileName $expectedMSBuildPath -Arguments "`"Some project file`" /nologo /m /nr:false /dl:CentralLogger,`"C:\Some agent home directory\Agent\Worker\Microsoft.TeamFoundation.DistributedTask.MSBuild.Logger.dll`"*ForwardingLogger,`"C:\Some agent home directory\Agent\Worker\Microsoft.TeamFoundation.DistributedTask.MSBuild.Logger.dll`"" -RequireExitCodeZero
Assert-WasCalled Write-VstsSetResult -Times 0
Assert-AreEqual -Expected @(
    'Some output 1'
    'Some output 2'
) -Actual $actual
