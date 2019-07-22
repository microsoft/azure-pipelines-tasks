[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\PreJobExecutionAzurePowerShell.ps1

Register-Mock Get-VstsInput { "FilePath" } -- -Name ScriptType -Require
Register-Mock Get-VstsInput { "$PSScriptRoot/PerformsBasicFlow_TargetScript.ps1" } -- -Name ScriptPath
Register-Mock Get-VstsInput { $targetAzurePs } -- -Name TargetAzurePs
Register-Mock Get-VstsInput { 'arg1 arg2' } -- -Name ScriptArguments
Register-Mock Get-VstsInput { "continue" } -- -Name errorActionPreference
Register-Mock Get-VstsInput { $true } -- -Name FailOnStandardError

$azModulePath = "c:\modules\az_3.6.0"

$azModulePattern = "^az_[0-9]+\.[0-9]+\.[0-9]+$"
$versionPattern = "[0-9]+\.[0-9]+\.[0-9]+$"

$variableSets = @(
    @{
        targetAzurePsVersion = "3.6.0"
        azModuleExist = $true
    }
    @{
        targetAzurePsVersion = ""
        azModulePath = $true
    }
)

$temp = $env:PSModulePath

foreach ($variableSet in $variableSets) {
    $env:PSModulePath = $temp
    # Arrange
    Unregister-Mock Get-LatestModule
    if($variableSet.azModuleExist) {
        Register-Mock Get-LatestModule { $azModulePath } -- -patternToMatch $azModulePattern -patternToExtract $versionPattern -Classic:$false
    } else {
        Register-Mock Get-LatestModule { "" } -- -patternToMatch $azModulePattern -patternToExtract $versionPattern -Classic:$false
    }

    # Act
    Update-PSModulePathForHostedAgent -targetAzurePs $variableSet.targetAzurePsVersion
    
    # Assert
    if($variableSet.azModuleExist) {
        Assert-IsGreaterThan -1 $env:PSModulePath.toLower().IndexOf($azModulePath)
    } else {
        Assert-AreEqual -1 $env:PSModulePath.toLower().IndexOf($azModulePath)
    }

    Assert-IsGreaterThan 0 $env:PSModulePath.toLower().IndexOf(";")
}
