[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
$now = Get-Date
$env:Build_BuildUri = 'Some build URI'
$env:Build_BuildNumber = 'Some build number'
$env:Build_Repository_Name = 'Some build repository name'
$env:Build_Repository_Uri = 'Some build repository URI'
$env:System_TeamProject = 'Some team project'
$env:System_TeamFoundationCollectionUri = 'Some team foundation collection URI'
Register-Mock Get-Date { $now }
Register-Mock Get-VstsTaskVariable
Register-Mock Find-VstsFiles { 'Some PDB file 1', 'Some PDB file 2' }
Register-Mock Invoke-IndexSources
Register-Mock Invoke-PublishSymbols
foreach ($treatNotIndexedAsWarning in @($true, $false)) {
    Unregister-Mock Get-VstsInput
    Register-Mock Get-VstsInput { '123' } -- -Name 'SymbolsMaximumWaitTime' -Default '0' -AsInt
    Register-Mock Get-VstsInput { '' } -- -Name 'SymbolsPath' # Empty to skip publishing.
    Register-Mock Get-VstsInput { 'Some input search pattern' } -ParametersEvaluator { $Name -eq 'SearchPattern' }
    Register-Mock Get-VstsInput { 'Some input symbols product' } -ParametersEvaluator { $Name -eq 'SymbolsProduct' }
    Register-Mock Get-VstsInput { 'Some input symbols version' } -ParametersEvaluator { $Name -eq 'SymbolsVersion' }
    Register-Mock Get-VstsInput { 'Some input symbols folder' } -ParametersEvaluator { $Name -eq 'SymbolsFolder' }
    Register-Mock Get-VstsInput { 'Some symbols artifact name' } -- -Name 'SymbolsArtifactName'
    Register-Mock Get-VstsInput { $treatNotIndexedAsWarning } -ParametersEvaluator { $Name -eq 'TreatNotIndexedAsWarning' }

    # Act.
    & $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishSymbols.ps1

    # Assert.
    Assert-WasCalled Find-VstsFiles -- -LiteralDirectory 'Some input symbols folder' -LegacyPattern 'Some input search pattern'
    Assert-WasCalled Invoke-IndexSources -- -SymbolsFilePaths ('Some PDB file 1', 'Some PDB file 2') -TreatNotIndexedAsWarning: $treatNotIndexedAsWarning
    Assert-WasCalled Invoke-PublishSymbols -Times 0
}
