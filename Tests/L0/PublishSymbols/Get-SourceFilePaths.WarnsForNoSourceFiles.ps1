[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\SourceFileFunctions.ps1
$symbolsFilePath = 'SomeDrive:\SomeSourceDir\SomeProject\SomeLibrary.pdb'
$sourceRootPath = 'SomeDrive:\SomeSourceDir'
Register-Mock Get-DbghelpSourceFilePaths
Register-Mock Test-Path { $true }
foreach ($treatNotIndexedAsWarning in @($true, $false)) {
    Unregister-Mock Write-Host
    Unregister-Mock Write-Warning
    Register-Mock Write-Host
    Register-Mock Write-Warning

    # Act.
    $actual = Get-SourceFilePaths -SymbolsFilePath $symbolsFilePath -SourcesRootPath $sourceRootPath -TreatNotIndexedAsWarning:$treatNotIndexedAsWarning

    # Assert.
    Assert-AreEqual $null $actual
    $atLeastOnce = -1
    Assert-WasCalled Write-Host -Time $(if ($treatNotIndexedAsWarning) { 0 } else { $atLeastOnce })
    Assert-WasCalled Write-Warning -Time $(if ($treatNotIndexedAsWarning) { $atLeastOnce } else { 0 })
}
