[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\PreJobExecutionAzurePowerShell.ps1

$azModulePath = "c:\modules\az_4.1.0"

$azModulePattern = "^az_[0-9]+\.[0-9]+\.[0-9]+$"
$versionPattern = "[0-9]+\.[0-9]+\.[0-9]+$"

$mockDirectoryStructure = @(
    @{
        Name = "az_4.1.0"
        FullName = "C:\Modules\az_4.1.0"
    }
    @{
        Name = "az_3.6.0"
        FullName = "C:\Modules\az_3.6.0"
    }
)

Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/PerformsBasicFlow_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { 'arg1 arg2' } -- -Name ScriptArguments
Register-Mock Get-VstsInput { "continue" } -- -Name errorActionPreference
Register-Mock Get-VstsInput { $true } -- -Name FailOnStandardError
Register-Mock Get-ChildItem { $mockDirectoryStructure } -- -Directory -Path "C:\Modules"
Register-Mock Test-Path { $true }

# Act
$result = Get-LatestModule -patternToMatch $azModulePattern -patternToExtract $versionPattern
# Assert
Assert-AreEqual $result.toLower() $azModulePath