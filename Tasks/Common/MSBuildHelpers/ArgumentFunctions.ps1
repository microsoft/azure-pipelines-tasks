function Format-MSBuildArguments {
    [CmdletBinding()]
    param(
        [string]$MSBuildArguments,
        [string]$Platform,
        [string]$Configuration,
        [string]$VSVersion)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        if ($Platform) {
            $MSBuildArguments = "$MSBuildArguments /p:platform=`"$Platform`""
        }

        if ($Configuration) {
            $MSBuildArguments = "$MSBuildArguments /p:configuration=`"$Configuration`""
        }

        if ($VSVersion) {
            $MSBuildArguments = "$MSBuildArguments /p:VisualStudioVersion=`"$VSVersion`""
        }

        $userAgent = Get-UserAgentString
        if (!([string]::IsNullOrEmpty($userAgent))) {
            $MSBuildArguments = "$MSBuildArguments /p:_MSDeployUserAgent=`"$userAgent`""
        }
        
        $MSBuildArguments
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-UserAgentString
{
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
    }
    
    return $userAgent
}
