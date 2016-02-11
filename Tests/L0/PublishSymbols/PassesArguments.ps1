[cmdletbinding()]
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
Register-Mock Find-Files { 'Some PDB file 1', 'Some PDB file 2' }
Register-Mock Invoke-IndexSources
Register-Mock Invoke-PublishSymbols
foreach ($treatNotIndexedAsWarning in @($true, $false)) {
    # Act.
    $splat = @{
        SymbolsPath = 'Some input symbols path'
        SearchPattern = 'Some input search pattern'
        SourceFolder = '' # Support for sourceFolder has been Deprecated.
        SymbolsProduct = 'Some input symbols product'
        SymbolsVersion = 'Some input symbols version'
        SymbolsMaximumWaitTime = '123'
        SymbolsFolder = 'Some input symbols folder'
        SymbolsArtifactName = 'Some symbols artifact name'
        SkipIndexing = 'false'
        TreatNotIndexedAsWarning = $treatNotIndexedAsWarning.ToString()
        OmitDotSource = 'true'
    }
    & $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishSymbols.ps1 @splat

    # Assert.
    Assert-WasCalled Find-Files -- -SearchPattern 'Some input search pattern' -RootFolder 'Some input symbols folder'
    Assert-WasCalled Invoke-IndexSources -- -SymbolsFilePaths ('Some PDB file 1', 'Some PDB file 2') -TreatNotIndexedAsWarning: $treatNotIndexedAsWarning
    $semaphoreMessage = "Machine: $env:ComputerName, BuildUri: Some build URI, BuildNumber: Some build number, RepositoryName: Some build repository name, RepositoryUri: Some build repository URI, Team Project: Some team project, CollectionUri: Some team foundation collection URI at $($now.ToUniversalTime()) UTC"
    Assert-WasCalled Invoke-PublishSymbols -- -PdbFiles ('Some PDB file 1', 'Some PDB file 2') -Share 'Some input symbols path' -Product 'Some input symbols product' -Version 'Some input symbols version' -MaximumWaitTime (123 * 60 * 1000).ToString() -MaximumSemaphoreAge (24 * 60).ToString() -ArtifactName 'Some symbols artifact name' -SemaphoreMessage $semaphoreMessage
}
