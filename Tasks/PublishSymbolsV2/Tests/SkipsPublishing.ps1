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
Register-Mock Find-VstsMatch { 'file-1.pdb', 'file-2.pdb', 'file-3.dll' }
Register-Mock Invoke-IndexSources
Register-Mock Invoke-PublishSymbols
foreach ($treatNotIndexedAsWarning in @($true, $false)) {
    foreach($ignoreIdxRetrievalError in @($true, $false)) {
        foreach($resolveGitSource in @($true, $false)) {
            foreach($sourceFolder in @('', 'some sources path')) {
                Unregister-Mock Get-VstsInput
                Register-Mock Get-VstsInput { '123' } -- -Name 'SymbolsMaximumWaitTime' -Default '0' -AsInt
                Register-Mock Get-VstsInput { '' } -- -Name 'SymbolsPath' # Empty to skip publishing.
                Register-Mock Get-VstsInput { 'FileShare' } -ParametersEvaluator { $Name -eq 'SymbolServerType' }
                Register-Mock Get-VstsInput { $true } -ParametersEvaluator { $Name -eq 'IndexSources' }
                Register-Mock Get-VstsInput { 'Some input search pattern' } -ParametersEvaluator { $Name -eq 'SearchPattern' }
                Register-Mock Get-VstsInput { 'Some input symbols product' } -ParametersEvaluator { $Name -eq 'SymbolsProduct' }
                Register-Mock Get-VstsInput { 'Some input symbols version' } -ParametersEvaluator { $Name -eq 'SymbolsVersion' }
                Register-Mock Get-VstsInput { 'Some input symbols folder' } -ParametersEvaluator { $Name -eq 'SymbolsFolder' }
                Register-Mock Get-VstsInput { 'Some symbols artifact name' } -- -Name 'SymbolsArtifactName'
                Register-Mock Get-VstsInput { $treatNotIndexedAsWarning } -ParametersEvaluator { $Name -eq 'TreatNotIndexedAsWarning' }
                Register-Mock Get-VstsInput { $ignoreIdxRetrievalError } -ParametersEvaluator { $Name -eq 'IgnoreIdxRetrievalError' }
                Register-Mock Get-VstsInput { $resolveGitSource } -ParametersEvaluator { $Name -eq 'ResolveGitSource' }
                Register-Mock Get-VstsInput { $sourceFolder } -ParametersEvaluator { $Name -eq 'SourceFolder' }
                $env:PublishSymbols_Debug = $null

                # Act.
                & $PSScriptRoot\..\PublishSymbols.ps1

                # Assert.
                Assert-WasCalled Find-VstsMatch -- -DefaultRoot 'Some input symbols folder' -Pattern 'Some input search pattern'
                Assert-WasCalled Invoke-IndexSources -- -SymbolsFilePaths ('file-1.pdb', 'file-2.pdb') -SourcesRootPath $sourceFolder -TreatNotIndexedAsWarning: $treatNotIndexedAsWarning -IgnoreIdxRetrievalError: $ignoreIdxRetrievalError -ResolveGitSource: $resolveGitSource
                Assert-WasCalled Invoke-PublishSymbols -Times 0
            }
        }
    }
}
