[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\..\..\Tasks\MSBuild\ps_modules\MSBuildHelpers

$variableSets = @(
    @{
        CollectionUri = 'https://test.visualstudio.com/'
        HostType = 'build'
    }
    @{
        CollectionUri = 'https://test.tfsallin.net'
        HostType = 'release'
    }
    @{
        CollectionUri = 'https://test.visualstudio.com/'
        HostType = 'test'
    }
)

foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Get-VstsTaskVariable
    Register-Mock Get-VstsTaskVariable { $variableSet.CollectionUri } -- -Name System.TeamFoundationCollectionUri -Require
    Register-Mock Get-VstsTaskVariable { 'collectionId' } -- -Name System.CollectionId -Require
    Register-Mock Get-VstsTaskVariable { $variableSet.HostType } -- -Name System.HostType -Require
    
    Register-Mock Get-VstsTaskVariable { 'definitionId' } -- -Name System.DefinitionId -Require
    Register-Mock Get-VstsTaskVariable { 'buildId' } -- -Name Build.BuildId -Require
    Register-Mock Get-VstsTaskVariable { 'releaseId' } -- -Name Release.ReleaseId -Require
    Register-Mock Get-VstsTaskVariable { 'definitionId' } -- -Name Release.DefinitionId  -Require
    Register-Mock Get-VstsTaskVariable { 'environmentId' } -- -Name Release.EnvironmentId -Require
    Register-Mock Get-VstsTaskVariable { 'attemptNumber' } -- -Name Release.AttemptNumber -Require
    
    # Act.  
    $actual = Get-UserAgentString
    
    # Assert.
    if (($variableSet.CollectionUri.ToLower().Contains("visualstudio.com".ToLower()))) {
        if ($variableSet.HostType -ieq 'build') {
            Assert-AreEqual "VSTS_collectionId_build_definitionId_buildId" $actual
        } else {
            Assert-AreEqual "" $actual
        }
    } else {
        Assert-AreEqual "TFS_collectionId_release_definitionId_releaseId_environmentId_attemptNumber" $actual
    }
}