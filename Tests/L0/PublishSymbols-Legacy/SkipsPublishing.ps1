[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
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
        SymbolsPath = '' # Empty to skip publishing.
        SearchPattern = 'Some input search pattern'
        SourceFolder = '' # Support for sourceFolder has been Deprecated.
        SymbolsProduct = 'Some input symbols product'
        SymbolsVersion = 'Some input symbols version'
        SymbolsMaximumWaitTime = '123'
        SymbolsFolder = 'Some input symbols folder'
        SymbolsArtifactName = 'Some symbols artifact name'
        SkipIndexing = 'false'
        TreatNotIndexedAsWarning = $treatNotIndexedAsWarning.ToString()
    }
    & $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyPublishSymbols.ps1 @splat

    # Assert.
    Assert-WasCalled Find-Files -- -SearchPattern 'Some input search pattern' -RootFolder 'Some input symbols folder'
    Assert-WasCalled Invoke-IndexSources -- -SymbolsFilePaths ('Some PDB file 1', 'Some PDB file 2') -TreatNotIndexedAsWarning: $treatNotIndexedAsWarning
    Assert-WasCalled Invoke-PublishSymbols -Times 0
}
