[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
$now = Get-Date
Register-Mock Get-Date { $now }
Register-Mock Find-Files { 'Some PDB file 1', 'Some PDB file 2' }
Register-Mock Invoke-IndexSources
Register-Mock Invoke-PublishSymbols

# Act.
$splat = @{
    SymbolsPath = 'Some input symbols path'
    SearchPattern = 'Some input search pattern'
    SourceFolder = '' # Support for sourceFolder has been Deprecated.
    SymbolsProduct = 'Some input symbols product'
    SymbolsVersion = 'Some input symbols version'
    SymbolsMaximumWaitTime = 'Some invalid symbols maximum wait time'
    SymbolsFolder = 'Some input symbols folder'
    SymbolsArtifactName = 'Some symbols artifact name'
    TreatNotIndexedAsWarning = 'true'
    OmitDotSource = 'true'
}
& $PSScriptRoot\..\..\..\Tasks\PublishSymbols\PublishSymbols.ps1 @splat

# Assert.
Assert-WasCalled Invoke-PublishSymbols -ParametersEvaluator { $MaximumWaitTime -eq (120 * 60 * 1000) }
