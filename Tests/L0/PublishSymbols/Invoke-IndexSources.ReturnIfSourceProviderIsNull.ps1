[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\IndexFunctions.ps1
$script:pdbstrExePath = 'SomeDrive:\SomeDir\pdbstr.exe'
$env:AGENT_HOMEDIRECTORY = 'SomeDrive:\AgentHome'
Register-Mock Assert-VstsPath { $script:pdbstrExePath } -- -LiteralPath "$env:Agent_HomeDirectory\Agent\Worker\Tools\Pdbstr\pdbstr.exe" -PathType Leaf -PassThru
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
