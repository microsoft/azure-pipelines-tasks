[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Utility.ps1

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

Register-Mock Get-ChildItem { $mockDirectoryStructure } -- -Directory -Path "C:\Modules"
Register-Mock Test-Path { $true }

# Act
$result = Get-LatestModule -patternToMatch $azModulePattern -patternToExtract $versionPattern
# Assert
Assert-AreEqual $result.toLower() $azModulePath