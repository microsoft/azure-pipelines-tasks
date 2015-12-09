[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

$now = Get-Date
$env:Build_BuildUri = 'Some build URI'
$env:Build_BuildNumber = 'Some build number'
$env:Build_DefinitionName = 'Some build definition name'
$env:Build_Repository_Name = 'Some build repository name'
$env:Build_Repository_Uri = 'Some build repository URI'
$env:Build_SourcesDirectory = 'Some build sources directory'
$env:System_TeamFoundationCollectionUri = 'Some team foundation collection URI'
$env:System_TeamProject = 'Some team project'
$defaultSearchPattern = "**\bin\**\*.pdb"
$defaultSymbolsProduct = 'Some build definition name'
$defaultSymbolsVersion = 'Some build number'
$defaultMaxWaitTime = [timespan]::FromHours(2)
$defaultMaxSemaphoreAge = [timespan]::FromDays(1)
$defaultSymbolsFolder = 'Some build sources directory'
Register-Mock Get-Date { $now }
Register-Mock Find-Files { 'Some PDB file 1', 'Some PDB file 2' }
Register-Mock Invoke-IndexSources
Register-Mock Invoke-PublishSymbols
# Act.
$splat = @{
    SymbolsPath = 'Some input symbols path'
    SearchPattern = ''
    SourceFolder = '' # Support for sourceFolder has been Deprecated.
    SymbolsProduct = ''
    SymbolsVersion = ''
    SymbolsMaximumWaitTime = ''
    SymbolsFolder = ''
    SymbolsArtifactName = 'Some symbols artifact name'
    TreatNotIndexedAsWarning = 'true'
    OmitDotSource = 'true'
}
& $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishSymbols.ps1 @splat

# Assert.
Assert-WasCalled Find-Files -- -SearchPattern $defaultSearchPattern -RootFolder $defaultSymbolsFolder
Assert-WasCalled Invoke-IndexSources -- -SymbolsFilePaths ('Some PDB file 1', 'Some PDB file 2') -TreatNotIndexedAsWarning: $true
$semaphoreMessage = "Machine: $env:ComputerName, BuildUri: Some build URI, BuildNumber: Some build number, RepositoryName: Some build repository name, RepositoryUri: Some build repository URI, Team Project: Some team project, CollectionUri: Some team foundation collection URI at $($now.ToUniversalTime()) UTC"
Assert-WasCalled Invoke-PublishSymbols -- -PdbFiles ('Some PDB file 1', 'Some PDB file 2') -Share 'Some input symbols path' -Product $defaultSymbolsProduct -Version $defaultSymbolsVersion -MaximumWaitTime (120 * 60 * 1000).ToString() -MaximumSemaphoreAge (24 * 60).ToString() -ArtifactName 'Some symbols artifact name' -SemaphoreMessage $semaphoreMessage
