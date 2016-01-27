[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyIndexHelpers.ps1
$env:TMP = "$env:TMP _"
Register-Mock Write-Warning
$script:pdbstrExePath = 'SomeDrive:\SomeDir\pdbstr.exe'
Register-Mock Get-ToolPath { $script:pdbstrExePath } -- -Name 'Pdbstr\pdbstr.exe'
Register-Mock Push-Location
Register-Mock Add-DbghelpLibrary { -1234 }
$script:sourcesRoot = 'SomeDrive:\SomeSourcesRoot'
$script:provider = New-Object psobject -Property @{ SourcesRootPath = $sourcesRoot }
Register-Mock Get-SourceProvider { $script:provider }
Register-Mock Get-SourceFilePaths
Register-Mock New-SrcSrvIniContent
Register-Mock Add-SourceServerStream
Register-Mock Invoke-DisposeSourceProvider
Register-Mock Remove-DbghelpLibrary

# Act.
Invoke-IndexSources -SymbolsFilePaths 'SomeDrive:\SomeDir\SomeAssembly.pdb' -TreatNotIndexedAsWarning:$false

# Assert.
Assert-WasCalled Get-SourceFilePaths
Assert-WasCalled Write-Warning -ArgumentsEvaluator { $args[0] -like '*Temp folder contains spaces in the path*' }
