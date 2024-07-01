[CmdletBinding()]
param()

$featureFlags = @{
    retireAzureRM  = [System.Convert]::ToBoolean($env:RETIRE_AZURERM_POWERSHELL_MODULE)
}

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Utility.ps1

$azureRmModulePath = "c:\modules\azurerm_3.6.0"
$azureModulePath = "c:\modules\azure_3.6.0"
$azModulePath = "c:\modules\az_3.6.0"

$azureRmModulePattern = "^azurerm_[0-9]+\.[0-9]+\.[0-9]+$"
$azureModulePattern = "^azure_[0-9]+\.[0-9]+\.[0-9]+$"
$versionPattern = "[0-9]+\.[0-9]+\.[0-9]+$"
$azModulePattern = "^az_[0-9]+\.[0-9]+\.[0-9]+$";

$variableSets = @(
    @{
        targetAzurePsVersion = "3.6.0"
        azureRmModuleExist = $true
        azureModuleExist = $true
    }
    @{
        targetAzurePsVersion = ""
        azureRmModulePath = $true
        azureModulePath = $true
    }
    @{
        targetAzurePsVersion = ""
        azureRmModulePath = $false
        azureModulePath = $true
    }
    @{
        targetAzurePsVersion = ""
        azureRmModulePath = $true
        azureModulePath = $false
    }
)

$temp = $env:PSModulePath

foreach ($variableSet in $variableSets) {
    $env:PSModulePath = $temp
    # Arrange
    Unregister-Mock Get-LatestModule

    if ($featureFlags.retireAzureRM) {
        Register-Mock Get-LatestModule { $azModulePath } -- -patternToMatch $azModulePattern -patternToExtract $versionPattern -moduleName:'Az'
    } else {
        if($variableSet.azureRmModuleExist) {
            Register-Mock Get-LatestModule { $azureRmModulePath } -- -patternToMatch $azureRmModulePattern -patternToExtract $versionPattern -Classic:$false
        } else {
            Register-Mock Get-LatestModule { "" } -- -patternToMatch $azureRmModulePattern -patternToExtract $versionPattern -Classic:$false
        }

        if($variableSet.azureModuleExist) {
            Register-Mock Get-LatestModule { $azureModulePath } -- -patternToMatch $azureModulePattern -patternToExtract $versionPattern -Classic:$true
        } else {
            Register-Mock Get-LatestModule { "" } -- -patternToMatch $azureModulePattern -patternToExtract $versionPattern -Classic:$true
        }
    }

    # Act
    Update-PSModulePathForHostedAgent -targetAzurePs $variableSet.targetAzurePsVersion
    
    # Assert
    if ($featureFlags.retireAzureRM) {
        Write-Output $env:PSModulePath;
        Write-Output $azModulePath;
        Assert-IsGreaterThan -1 $env:PSModulePath.toLower().IndexOf($azModulePath)
    } else {
        if($variableSet.azureRmModuleExist) {
            Assert-IsGreaterThan -1 $env:PSModulePath.toLower().IndexOf($azureRmModulePath)
        } else {
            Assert-AreEqual -1 $env:PSModulePath.toLower().IndexOf($azureRmModulePath)
        }

        if($variableSet.azureModuleExist) {
            Assert-IsGreaterThan -1 $env:PSModulePath.toLower().IndexOf($azureModulePath)
        } else {
            Assert-AreEqual -1 $env:PSModulePath.toLower().IndexOf($azureModulePath)
        }
    }
    Assert-IsGreaterThan 0 $env:PSModulePath.toLower().IndexOf(";")
}
