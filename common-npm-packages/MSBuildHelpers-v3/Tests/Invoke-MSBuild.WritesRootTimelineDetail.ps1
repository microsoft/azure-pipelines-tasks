[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\MSBuildHelpers.psm1 -PassThru
$expectedMSBuildPath = "C:\Some msbuild dir\msbuild.exe"
$expectedLoggerPath = ([System.IO.Path]::GetFullPath("$PSScriptRoot\..\tools\Microsoft.TeamFoundation.DistributedTask.MSBuild.Logger.dll"))
Register-Mock Get-MSBuildPath { $expectedMSBuildPath }
Register-Mock Assert-VstsPath
Register-Mock Get-VstsTaskVariable { "C:\Some agent home directory" } -- -Name Agent.HomeDirectory -Require
Register-Mock Invoke-VstsTool { $global:LASTEXITCODE = 0 ; 'Some output 1' ; 'Some output 2' }
Register-Mock Write-VstsSetResult
Register-Mock Write-VstsLogDetail
$expectedProjectFile = 'C:\Some solution dir\Some solution file.sln'

# Act.
$actual = & $module Invoke-MSBuild -ProjectFile $expectedProjectFile

# Assert.
Assert-WasCalled Assert-VstsPath -- -LiteralPath $expectedMSBuildPath -PathType Leaf
Assert-WasCalled Assert-VstsPath -- -LiteralPath $expectedLoggerPath -PathType Leaf
Assert-WasCalled Write-VstsLogDetail -ParametersEvaluator {
        $script:rootDetailId = $Id
        return $Id -is [guid] -and
            $Id -ne [guid]::Empty -and
            $Type -eq 'Process' -and
            $Name -eq "MSB_Build0 Some solution file.sln" -and
            $Progress -eq 0 -and
            $StartTime -like '????-??-??T??:??:??.*Z' -and
            $State -eq 'Initialized' -and
            $AsOutput -eq $true
    }
Assert-WasCalled Invoke-VstsTool -- -FileName $expectedMSBuildPath -Arguments "`"$expectedProjectFile`" /nologo /nr:false /dl:CentralLogger,`"$expectedLoggerPath`";`"RootDetailId=$script:rootDetailId|SolutionDir=C:\Some solution dir|enableOrphanedProjectsLogs=true`"*ForwardingLogger,`"$expectedLoggerPath`"" -RequireExitCodeZero
Assert-WasCalled Write-VstsSetResult -Times 0
Assert-AreEqual -Expected @(
        'Some output 1'
        'Some output 2'
    ) -Actual $actual
Assert-WasCalled Write-VstsLogDetail -ParametersEvaluator {
        return $Id -eq $script:rootDetailId -and
            $FinishTime -like '????-??-??T??:??:??.*Z' -and
            $Progress -eq 100 -and
            $State -eq 'Completed' -and
            $Result -eq 'Succeeded' -and
            $AsOutput -eq $true
    }
