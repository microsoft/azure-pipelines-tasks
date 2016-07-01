[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_ -PassThru

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
	Unregister-Mock Set-UserAgent_Core
    Register-Mock Get-VstsTaskVariable { $variableSet.CollectionUri } -- -Name System.TeamFoundationCollectionUri -Require
	Register-Mock Get-VstsTaskVariable { 'collectionId' } -- -Name System.CollectionId -Require
	Register-Mock Get-VstsTaskVariable { $variableSet.HostType } -- -Name System.HostType -Require
	
	Register-Mock Get-VstsTaskVariable { 'definitionId' } -- -Name System.DefinitionId -Require
	Register-Mock Get-VstsTaskVariable { 'buildId' } -- -Name Build.BuildId -Require
	Register-Mock Get-VstsTaskVariable { 'releaseId' } -- -Name Release.ReleaseId -Require
	Register-Mock Get-VstsTaskVariable { 'definitionId' } -- -Name Release.DefinitionId  -Require
	Register-Mock Get-VstsTaskVariable { 'environmentId' } -- -Name Release.EnvironmentId -Require
	Register-Mock Get-VstsTaskVariable { 'attemptNumber' } -- -Name Release.AttemptNumber -Require
	
	Register-Mock Set-UserAgent_Core

    # Act.	
    & $module Set-UserAgent
	
    # Assert.
    if (($variableSet.CollectionUri.ToLower().Contains("visualstudio.com".ToLower()))) {
        if ($variableSet.HostType -ieq 'build') {
		    Assert-WasCalled Set-UserAgent_Core -- -UserAgent 'VSTS_collectionId_build_definitionId_buildId'
		} else {
		    Assert-WasCalled Set-UserAgent_Core -Times 0
		}
    } else {
        Assert-WasCalled Set-UserAgent_Core -- -UserAgent 'TFS_collectionId_release_definitionId_releaseId_environmentId_attemptNumber'
    }
}
<#
function Set-UserAgent {
    [CmdletBinding()]
    param()
	
	$collectionUri = Get-VstsTaskVariable -Name System.TeamFoundationCollectionUri -Require
    $collectionId = Get-VstsTaskVariable -Name System.CollectionId -Require
	$hostType = Get-VstsTaskVariable -Name System.HostType -Require
    $serverString = "TFS"
    if ($collectionUri.ToLower().Contains("visualstudio.com".ToLower())) {
        $serverString = "VSTS"
    }
    
    $userAgent = [string]::Empty
    if ($hostType -ieq "build") {
		$definitionId = Get-VstsTaskVariable -Name System.DefinitionId -Require
		$buildId = Get-VstsTaskVariable -Name Build.BuildId -Require
		$userAgent = $serverString + "_" + $collectionId + "_" + "build" + "_" + $definitionId + "_" + $buildId
    } elseif ($hostType -ieq "release") {
        $definitionId = Get-VstsTaskVariable -Name Release.DefinitionId -Require
		$releaseId = Get-VstsTaskVariable -Name Release.ReleaseId -Require
		$environmentId = Get-VstsTaskVariable -Name Release.EnvironmentId -Require
		$attemptNumber = Get-VstsTaskVariable -Name Release.AttemptNumber -Require
		$userAgent = $serverString + "_" + $collectionId + "_" + "release" + "_" + $definitionId + "_" + $releaseId + "_" + $environmentId + "_" + $attemptNumber
    } else {
	    return
	}
	
    Set-UserAgent_Core -UserAgent $userAgent
}
#>