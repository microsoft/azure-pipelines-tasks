[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\PdbstrFunctions.ps1
$global:tempFileCount = 0
Register-Mock Get-TempFileName { "SomeDrive:\TempDir\TempFile$($global:tempFileCount++ ; $global:tempFileCount).txt" }
Register-Mock Copy-Item
Register-Mock Remove-Item
Register-Mock Write-AllText
Register-Mock Invoke-VstsTool

# Act.
Add-SourceServerStream -PdbstrPath 'Some pdbstr.exe path' -SymbolsFilePath 'SomeDrive:\SomeDir\SomeSymbols With Space.pdb' -StreamContent 'Some stream content'

# Assert.
Assert-AreEqual 2 $global:tempFileCount
Assert-WasCalled Write-AllText -- -Path 'SomeDrive:\TempDir\TempFile1.txt' -Content 'Some stream content'
Assert-WasCalled Invoke-VstsTool -- -FileName 'Some pdbstr.exe path' -Arguments "-w -p:""SomeDrive:\TempDir\TempFile2.txt"" -i:""SomeDrive:\TempDir\TempFile1.txt"" -s:srcsrv" -Verbose: $false
Assert-WasCalled Copy-Item -Times 2
Assert-WasCalled Copy-Item -- -LiteralPath 'SomeDrive:\SomeDir\SomeSymbols With Space.pdb' -Destination 'SomeDrive:\TempDir\TempFile2.txt'
Assert-WasCalled Copy-Item -- -LiteralPath 'SomeDrive:\TempDir\TempFile2.txt' -Destination 'SomeDrive:\SomeDir\SomeSymbols With Space.pdb'
Assert-WasCalled Remove-Item -Times 2
Assert-WasCalled Remove-Item -- -LiteralPath 'SomeDrive:\TempDir\TempFile1.txt'
Assert-WasCalled Remove-Item -- -LiteralPath 'SomeDrive:\TempDir\TempFile2.txt'
