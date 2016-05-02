[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\PdbstrFunctions.ps1
Register-Mock Get-TempFileName { 'SomeDrive:\TempDir\TempFile.txt' }
Register-Mock Copy-Item
Register-Mock Remove-Item
Register-Mock Write-AllText
Register-Mock Invoke-VstsTool

# Act.
Add-SourceServerStream -PdbstrPath 'Some pdbstr.exe path' -SymbolsFilePath 'SomeDrive:\SomeDir\SomeSymbols.pdb' -StreamContent 'Some stream content'

# Assert.
Assert-WasCalled Write-AllText -- -Path 'SomeDrive:\TempDir\TempFile.txt' -Content 'Some stream content'
Assert-WasCalled Invoke-VstsTool -- -FileName 'Some pdbstr.exe path' -Arguments "-w -p:""SomeDrive:\SomeDir\SomeSymbols.pdb"" -i:""SomeDrive:\TempDir\TempFile.txt"" -s:srcsrv" -Verbose: $false
Assert-WasCalled Copy-Item -Times 0
Assert-WasCalled Remove-Item -Times 1
Assert-WasCalled Remove-Item -- -LiteralPath 'SomeDrive:\TempDir\TempFile.txt'
