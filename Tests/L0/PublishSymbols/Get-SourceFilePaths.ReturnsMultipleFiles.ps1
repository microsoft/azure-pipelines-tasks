[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\SourceFileFunctions.ps1
$symbolsFilePath = 'SomeDrive:\SomeSourceDir\SomeProject\SomeLibrary.pdb'
$sourceRootPath = 'SomeDrive:\SomeSourceDir\\\' # The function should handle zero or more trailing slashes properly when
                                                # checking whether the source files are under the source root directory.
$global:sourceFile1 = ' SomeDrive:\SomeSourceDir\SomeProject\SomeFile1.cs ' # Spaces should be trimmed by the function.
$global:sourceFile2 = ' SomeDrive:\SomeSourceDir\SomeProject\SomeFile2.cs '
Register-Mock Get-DbghelpSourceFilePaths {
        $global:sourceFile1
        $global:sourceFile2
    } -- -SymbolsFilePath $symbolsFilePath
Register-Mock Test-Path { $true }
Register-Mock Trace-VstsPath
Register-Mock Write-Host
Register-Mock Write-Warning

# Act.
$actual = Get-SourceFilePaths -SymbolsFilePath $symbolsFilePath -SourcesRootPath $sourceRootPath -TreatNotIndexedAsWarning

# Assert.
Assert-AreEqual $global:sourceFile1.Trim(), $global:sourceFile2.Trim() $actual
Assert-WasCalled Write-Host -Time 0    # Write-Host/Write-Warning should only be called for warning
Assert-WasCalled Write-Warning -Time 0 # cases. The warning tests rely on this assumption also.
Assert-WasCalled Test-Path -- -LiteralPath $global:sourceFile1.Trim() -PathType Leaf
Assert-WasCalled Test-Path -- -LiteralPath $global:sourceFile1.Trim() -PathType Leaf
