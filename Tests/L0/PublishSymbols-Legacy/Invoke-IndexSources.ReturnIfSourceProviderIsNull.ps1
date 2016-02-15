[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyIndexHelpers.ps1
$script:pdbstrExePath = 'SomeDrive:\SomeDir\pdbstr.exe'
Register-Mock Get-ToolPath { $script:pdbstrExePath } -- -Name 'Pdbstr\pdbstr.exe'
Register-Mock Push-Location
$script:libraryHandle = -1234
Register-Mock Add-DbghelpLibrary { $script:libraryHandle }
$script:sourcesRoot = 'SomeDrive:\SomeSourcesRoot'
Register-Mock Get-SourceProvider
Register-Mock Get-SourceFilePaths
Register-Mock New-SrcSrvIniContent
Register-Mock Add-SourceServerStream
Register-Mock Invoke-DisposeSourceProvider
Register-Mock Remove-DbghelpLibrary

# Act.
Invoke-IndexSources -SymbolsFilePaths 'SomeDrive:\SomeDir\SomeLibrary1.pdb' -TreatNotIndexedAsWarning

# Assert.
Assert-WasCalled Push-Location $env:TEMP
Assert-WasCalled Get-SourceFilePaths -Times 0
Assert-WasCalled Invoke-DisposeSourceProvider -- -Provider $null
Assert-WasCalled Remove-DbghelpLibrary -- -HModule $libraryHandle
