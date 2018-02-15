[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
$now = Get-Date
Register-Mock Get-Date { $now }
Register-Mock Find-VstsMatch { 'Some PDB file 1', 'Some PDB file 2' }
Register-Mock Invoke-IndexSources
Register-Mock Invoke-PublishSymbols
Register-Mock Get-VstsTaskVariable
Register-Mock Get-VstsInput { 'FileShare' } -ParametersEvaluator { $Name -eq 'SymbolServerType' }
Register-Mock Get-VstsInput { $true } -ParametersEvaluator { $Name -eq 'IndexSources' }
Register-Mock Get-VstsInput { $true } -ParametersEvaluator { $Name -eq 'PublishSymbols' }
Register-Mock Get-VstsInput { '-1' } -- -Name 'SymbolsMaximumWaitTime' -Default '0' -AsInt
Register-Mock Get-VstsInput { 'Some input symbols path' } -- -Name 'SymbolsPath'
Register-Mock Get-VstsInput { 'Some input search pattern' } -ParametersEvaluator { $Name -eq 'SearchPattern' }
Register-Mock Get-VstsInput { 'Some input symbols product' } -ParametersEvaluator { $Name -eq 'SymbolsProduct' }
Register-Mock Get-VstsInput { 'Some input symbols version' } -ParametersEvaluator { $Name -eq 'SymbolsVersion' }
Register-Mock Get-VstsInput { 'Some input symbols folder' } -ParametersEvaluator { $Name -eq 'SymbolsFolder' }
Register-Mock Get-VstsInput { 'Some symbols artifact name' } -- -Name 'SymbolsArtifactName'
Register-Mock Get-VstsInput { $true } -ParametersEvaluator { $Name -eq 'TreatNotIndexedAsWarning' }
$env:PublishSymbols_Debug = $null

# Act.
& $PSScriptRoot\..\PublishSymbols.ps1

# Assert.
Assert-WasCalled Invoke-PublishSymbols -ParametersEvaluator { $MaximumWaitTime -eq ([timespan]::FromHours(2)) }
