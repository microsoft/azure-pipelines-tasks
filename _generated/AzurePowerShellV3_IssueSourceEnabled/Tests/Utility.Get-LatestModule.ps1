[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Utility.ps1

$azureRmModulePath = "c:\modules\azurerm_4.1.0"
$azureModulePath = "c:\modules\azure_3.6.0"

$azureRmModulePattern = "^azurerm_[0-9]+\.[0-9]+\.[0-9]+$"
$azureModulePattern = "^azure_[0-9]+\.[0-9]+\.[0-9]+$"
$versionPattern = "[0-9]+\.[0-9]+\.[0-9]+$"

$mockDirectoryStructure = @(
    @{
        Name = "azurerm_4.1.0"
        FullName = "C:\Modules\azurerm_4.1.0"
    }
    @{
        Name = "azurerm_3.6.0"
        FullName = "C:\Modules\azurerm_3.6.0"
    }
    @{
        Name = "azure_3.6.0"
        FullName = "C:\Modules\azure_3.6.0"
    }
)

Register-Mock Get-ChildItem { $mockDirectoryStructure } -- -Directory -Path "C:\Modules"
Register-Mock Test-Path { $true }

# Act
$result = Get-LatestModule -patternToMatch $azureRmModulePattern -patternToExtract $versionPattern
# Assert
Assert-AreEqual $result.toLower() $azureRmModulePath

# Act
$result = Get-LatestModule -patternToMatch $azureModulePattern -patternToExtract $versionPattern
# Assert
Assert-AreEqual $result.toLower() $azureModulePath