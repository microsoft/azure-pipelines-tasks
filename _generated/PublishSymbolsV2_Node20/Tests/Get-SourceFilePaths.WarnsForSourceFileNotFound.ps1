[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\IndexHelpers\SourceFileFunctions.ps1
$symbolsFilePath = 'SomeDrive:\SomeSourceDir\SomeProject\SomeLibrary.pdb'
$sourceRootPath = 'SomeDrive:\SomeSourceDir'
$global:sourceFile1 = 'SomeDrive:\SomeSourceDir\SomeProject\SomeFile1.cs'
$global:sourceFile2 = 'SomeDrive:\SomeSourceDir\SomeProject\SomeFile2.cs'
$global:sourceFile3 = 'SomeDrive:\SomeSourceDir\SomeProject\SomeFile3.cs'
$global:sourceFile4 = 'SomeDrive:\SomeSourceDir\??\SomeProject\SomeFile3.cs'
Register-Mock Get-DbghelpSourceFilePaths {
        $global:sourceFile1
        $global:sourceFile2
        $global:sourceFile3
        $global:sourceFile4
    } -- -SymbolsFilePath $symbolsFilePath
Register-Mock Test-Path { $true } -- -LiteralPath $symbolsFilePath -PathType Leaf
Register-Mock Test-Path { $true } -- -LiteralPath $global:sourceFile1 -PathType Leaf
Register-Mock Test-Path { $false } -- -LiteralPath $global:sourceFile2 -PathType Leaf
Register-Mock Test-Path { $true } -- -LiteralPath $global:sourceFile3 -PathType Leaf
Register-Mock Test-Path { throw New-Object System.ArgumentException  } -- -LiteralPath $global:sourceFile4 -PathType Leaf
Register-Mock Trace-VstsPath
foreach ($treatNotIndexedAsWarning in @($true, $false)) {
    Unregister-Mock Write-Host
    Unregister-Mock Write-Warning
    Register-Mock Write-Host
    Register-Mock Write-Warning

    # Act.
    $actual = Get-SourceFilePaths -SymbolsFilePath $symbolsFilePath -SourcesRootPath $sourceRootPath -TreatNotIndexedAsWarning:$treatNotIndexedAsWarning

    # Assert.
    Assert-AreEqual ($global:sourceFile1, $global:sourceFile3) $actual
    $atLeastOnce = -1
    Assert-WasCalled Write-Host -Time $(if ($treatNotIndexedAsWarning) { 0 } else { $atLeastOnce })
    Assert-WasCalled Write-Warning -Time $(if ($treatNotIndexedAsWarning) { $atLeastOnce } else { 0 })
}
