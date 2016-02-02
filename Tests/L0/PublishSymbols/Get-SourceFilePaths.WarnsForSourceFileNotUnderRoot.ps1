[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\SourceFileFunctions.ps1
$symbolsFilePath = 'SomeDrive:\SomeSourceDir\SomeProject\SomeLibrary.pdb'
$sourceRootPath = 'SomeDrive:\SomeSourceDir'
$global:sourceFile1 = 'SomeDrive:\SomeSourceDir\SomeProject\SomeFile1.cs'
$global:sourceFile2 = 'SomeDrive:\SomeSourceDirectory\SomeProject\SomeFile2.cs'
$global:sourceFile3 = 'SomeDrive:\SomeSource\SomeProject\SomeFile3.cs'
$global:sourceFile4 = 'SomeDrive:\SomeSourceDir\SomeProject\SomeFile4.cs'
Register-Mock Get-DbghelpSourceFilePaths {
        $global:sourceFile1
        $global:sourceFile2
        $global:sourceFile3
        $global:sourceFile4
    } -- -SymbolsFilePath $symbolsFilePath
Register-Mock Test-Path { $true }
Register-Mock Trace-VstsPath
foreach ($treatNotIndexedAsWarning in @($true, $false)) {
    Unregister-Mock Write-Host
    Unregister-Mock Write-Warning
    Register-Mock Write-Host
    Register-Mock Write-Warning

    # Act.
    $actual = Get-SourceFilePaths -SymbolsFilePath $symbolsFilePath -SourcesRootPath $sourceRootPath -TreatNotIndexedAsWarning:$treatNotIndexedAsWarning

    # Assert.
    Assert-AreEqual ($global:sourceFile1, $global:sourceFile4) $actual
    $atLeastOnce = -1
    Assert-WasCalled Write-Host -Time $(if ($treatNotIndexedAsWarning) { 0 } else { $atLeastOnce })
    Assert-WasCalled Write-Warning -Time $(if ($treatNotIndexedAsWarning) { $atLeastOnce } else { 0 })
}
