[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
$now = Get-Date
$env:Build_BuildUri = 'Some build URI'
$env:Build_BuildNumber = 'Some build number'
$env:Build_Repository_Name = 'Some build repository name'
$env:Build_Repository_Uri = 'Some build repository URI'
$env:System_TeamProject = 'Some team project'
$env:System_TeamFoundationCollectionUri = 'Some team foundation collection URI'
Register-Mock Get-Date { $now }
Register-Mock Get-VstsTaskVariable
Register-Mock Find-VstsMatch { 'Some PDB file 1', 'Some PDB file 2' }
Register-Mock Invoke-IndexSources
Register-Mock Invoke-PublishSymbols
foreach ($treatNotIndexedAsWarning in @($true, $false)) {
    Unregister-Mock Get-VstsInput
    Register-Mock Get-VstsInput { '123' } -- -Name 'SymbolsMaximumWaitTime' -Default '0' -AsInt
    Register-Mock Get-VstsInput { 'FileShare' } -ParametersEvaluator { $Name -eq 'SymbolServerType' }
    Register-Mock Get-VstsInput { 'Some input symbols path' } -- -Name 'SymbolsPath'
    Register-Mock Get-VstsInput { 'Some input search pattern' } -ParametersEvaluator { $Name -eq 'SearchPattern' }
    Register-Mock Get-VstsInput { 'Some input symbols product' } -ParametersEvaluator { $Name -eq 'SymbolsProduct' }
    Register-Mock Get-VstsInput { 'Some input symbols version' } -ParametersEvaluator { $Name -eq 'SymbolsVersion' }
    Register-Mock Get-VstsInput { 'Some input symbols folder' } -ParametersEvaluator { $Name -eq 'SymbolsFolder' }
    Register-Mock Get-VstsInput { 'Some symbols artifact name' } -- -Name 'SymbolsArtifactName'
    Register-Mock Get-VstsInput { $treatNotIndexedAsWarning } -ParametersEvaluator { $Name -eq 'TreatNotIndexedAsWarning' }
    Register-Mock Get-VstsInput { $false } -- -Name 'IndexSources' -AsBool
    Register-Mock Get-VstsInput { $false } -- -Name 'CompressSymbols' -AsBool
    Register-Mock Get-VstsInput { $true } -ParametersEvaluator { $Name -eq 'PublishSymbols' }
    $env:PublishSymbols_Debug = $null

    # Act.
    & $PSScriptRoot\..\PublishSymbols.ps1

    # Assert.
    Assert-WasCalled Find-VstsMatch -- -DefaultRoot 'Some input symbols folder' -Pattern 'Some input search pattern'
    Assert-WasCalled Invoke-IndexSources -Times 0
    $semaphoreMessage = "Machine: $env:ComputerName, BuildUri: Some build URI, BuildNumber: Some build number, RepositoryName: Some build repository name, RepositoryUri: Some build repository URI, Team Project: Some team project, CollectionUri: Some team foundation collection URI at $($now.ToUniversalTime()) UTC"
    Assert-WasCalled Invoke-PublishSymbols -- -PdbFiles ('Some PDB file 1', 'Some PDB file 2') -Share 'Some input symbols path' -Product 'Some input symbols product' -Version 'Some input symbols version' -MaximumWaitTime ([timespan]::FromMinutes(123)) -ArtifactName 'Some symbols artifact name' -SemaphoreMessage $semaphoreMessage -CompressSymbols:$false
}
