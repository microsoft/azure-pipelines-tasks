[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyIndexHelpers.ps1
$symbolsFilePath = 'SomeDrive:\SomeSourceDir\SomeProject\SomeLibrary.pdb'
$sourceRootPath = 'SomeDrive:\SomeSourceDir\\\' # The function should handle zero or more trailing slashes properly when
Register-Mock Test-Path { $false }

# Act/Assert.
Assert-Throws {
        Get-SourceFilePaths -SymbolsFilePath $symbolsFilePath -SourcesRootPath $sourceRootPath -TreatNotIndexedAsWarning
    } -MessagePattern "*The file $([System.Management.Automation.WildcardPattern]::Escape($symbolsFilePath)) could not be found*"
Assert-WasCalled Test-Path -- -LiteralPath $symbolsFilePath -PathType Leaf
