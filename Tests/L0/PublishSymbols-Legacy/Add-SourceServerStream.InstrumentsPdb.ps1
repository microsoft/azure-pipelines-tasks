[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyIndexHelpers.ps1
Register-Mock Get-TempFileName { 'SomeDrive:\TempDir\TempFile.txt' }
Register-Mock Copy-Item
Register-Mock Remove-Item
Register-Mock Write-AllText
function MockPdbstrExe { $global:actualPdbstrArgs = $args[0] }

# Act.
Add-SourceServerStream -PdbstrPath 'MockPdbstrExe' -SymbolsFilePath 'SomeDrive:\SomeDir\SomeSymbols.pdb' -StreamContent 'Some stream content'

# Assert.
Assert-WasCalled Write-AllText -- -Path 'SomeDrive:\TempDir\TempFile.txt' -Content 'Some stream content'
Assert-AreEqual -Expected @(
        "-w"
        "-p:""SomeDrive:\SomeDir\SomeSymbols.pdb"""
        "-i:""SomeDrive:\TempDir\TempFile.txt"""
        "-s:srcsrv"
    ) -Actual $global:actualPdbstrArgs
Assert-WasCalled Copy-Item -Times 0
Assert-WasCalled Remove-Item -Times 1
Assert-WasCalled Remove-Item -- -LiteralPath 'SomeDrive:\TempDir\TempFile.txt'
