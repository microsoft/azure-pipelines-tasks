[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\IndexFunctions.ps1
$env:TMP = "$env:TMP _"
Register-Mock Write-Warning
$script:pdbstrExePath = 'SomeDrive:\SomeDir\pdbstr.exe'
$env:AGENT_HOMEDIRECTORY = 'SomeDrive:\AgentHome'
Register-Mock Assert-VstsPath { $script:pdbstrExePath } -- -LiteralPath "$env:Agent_HomeDirectory\Agent\Worker\Tools\Pdbstr\pdbstr.exe" -PathType Leaf -PassThru
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
Assert-WasCalled Write-Warning -ArgumentsEvaluator { $args[0] -like 'SpacesInTemp' }
