# For more information on the VSTS Task SDK:
# https://github.com/Microsoft/vsts-task-lib

[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
try {
    # Import the localized strings. 
    Import-VstsLocStrings "$PSScriptRoot\task.json"
    
    # Load utility functions
    . "$PSScriptRoot\utilities.ps1"
    
    # Collect input values
    $publishProfilePathSearchPattern = Get-VstsInput -Name publishProfilePath -Require
    Write-Host (Get-VstsLocString -Key SearchingForPublishProfile -ArgumentList $publishProfilePathSearchPattern) 
    $publishProfilePath = Find-VstsFiles -LegacyPattern $publishProfilePathSearchPattern
    Assert-SingleItem $publishProfilePath $publishProfilePathSearchPattern
    Assert-VstsPath -LiteralPath $publishProfilePath -PathType Leaf
    Write-Host (Get-VstsLocString -Key FoundPublishProfile -ArgumentList $publishProfilePath)
    
    $applicationPackagePathSearchPattern = Get-VstsInput -Name applicationPackagePath -Require
    Write-Host (Get-VstsLocString -Key SearchingForApplicationPackage -ArgumentList $applicationPackagePathSearchPattern)

    $applicationPackagePath = Find-VstsFiles -LegacyPattern $applicationPackagePathSearchPattern -IncludeDirectories
    Assert-SingleItem $applicationPackagePath $applicationPackagePathSearchPattern
    Assert-VstsPath -LiteralPath $applicationPackagePath -PathType Container
    Write-Host (Get-VstsLocString -Key FoundApplicationPackage -ArgumentList $applicationPackagePath)

    $aadServiceConnectionName = Get-VstsInput -Name aadServiceConnectionName -Require
    $aadConnectedServiceEndpoint = Get-VstsEndpoint -Name $aadServiceConnectionName -Require

    $publishProfile = Read-PublishProfile $publishProfilePath
    $clusterConnectionParameters = $publishProfile.ClusterConnectionParameters
    
    if (-not $clusterConnectionParameters.ContainsKey("AzureActiveDirectory") -or $clusterConnectionParameters.Item("AzureActiveDirectory") -eq $false)
    {
        throw (Get-VstsLocString -Key AzureActiveDirectoryNotSet)
    }
    
    # Connect to cluster
    $securityToken = Get-AadSecurityToken -ClusterConnectionParameters $clusterConnectionParameters -ConnectedServiceEndpoint $aadConnectedServiceEndpoint
    $clusterConnectionParameters["SecurityToken"] = $securityToken
    $clusterConnectionParameters["WarningAction"] = "SilentlyContinue"
    [void](Connect-ServiceFabricCluster @clusterConnectionParameters)
    Write-Host (Get-VstsLocString -Key ConnectedToCluster)
    
    $regKey = "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK"
    if (!(Test-Path $regKey))
    {
        throw (Get-VstsLocString -Key ServiceFabricSDKNotInstalled)
    }
    
    . "$PSScriptRoot\ServiceFabricSDK\ServiceFabricSDK.ps1"

    $applicationName = Get-ApplicationNameFromApplicationParameterFile $publishProfile.ApplicationParameterFile
    $app = Get-ServiceFabricApplication -ApplicationName $applicationName
    
    # Do an upgrade if the publish profile is configured to do so and the app actually exists
    $isUpgrade = ($publishProfile.UpgradeDeployment -and $publishProfile.UpgradeDeployment.Enabled -and $app)
    
    if ($isUpgrade)
    {
        Publish-UpgradedServiceFabricApplication -ApplicationPackagePath $applicationPackagePath -ApplicationParameterFilePath $publishProfile.ApplicationParameterFile -Action RegisterAndUpgrade -UpgradeParameters $publishProfile.UpgradeDeployment.Parameters -UnregisterUnusedVersions -ErrorAction Stop
    }
    else
    {
        Publish-NewServiceFabricApplication -ApplicationPackagePath $ApplicationPackagePath -ApplicationParameterFilePath $publishProfile.ApplicationParameterFile -Action RegisterAndCreate -OverwriteBehavior SameAppTypeAndVersion -ErrorAction Stop 
    }
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}