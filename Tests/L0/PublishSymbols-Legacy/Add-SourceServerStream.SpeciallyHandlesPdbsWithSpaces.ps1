[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyIndexHelpers.ps1
$global:tempFileCount = 0
Register-Mock Get-TempFileName { "SomeDrive:\TempDir\TempFile$($global:tempFileCount++ ; $global:tempFileCount).txt" }
Register-Mock Copy-Item
Register-Mock Remove-Item
Register-Mock Write-AllText
function MockPdbstrExe { $global:actualPdbstrArgs = $args[0] }

# Act.
Add-SourceServerStream -PdbstrPath 'MockPdbstrExe' -SymbolsFilePath 'SomeDrive:\SomeDir\SomeSymbols With Space.pdb' -StreamContent 'Some stream content'

# Assert.
Assert-AreEqual 2 $global:tempFileCount
Assert-WasCalled Write-AllText -- -Path 'SomeDrive:\TempDir\TempFile1.txt' -Content 'Some stream content'
Assert-AreEqual -Expected @(
        "-w"
        "-p:""SomeDrive:\TempDir\TempFile2.txt"""
        "-i:""SomeDrive:\TempDir\TempFile1.txt"""
        "-s:srcsrv"
    ) -Actual $global:actualPdbstrArgs
Assert-WasCalled Copy-Item -Times 2
Assert-WasCalled Copy-Item -- -LiteralPath 'SomeDrive:\SomeDir\SomeSymbols With Space.pdb' -Destination 'SomeDrive:\TempDir\TempFile2.txt'
Assert-WasCalled Copy-Item -- -LiteralPath 'SomeDrive:\TempDir\TempFile2.txt' -Destination 'SomeDrive:\SomeDir\SomeSymbols With Space.pdb'
Assert-WasCalled Remove-Item -Times 2
Assert-WasCalled Remove-Item -- -LiteralPath 'SomeDrive:\TempDir\TempFile1.txt'
Assert-WasCalled Remove-Item -- -LiteralPath 'SomeDrive:\TempDir\TempFile2.txt'
