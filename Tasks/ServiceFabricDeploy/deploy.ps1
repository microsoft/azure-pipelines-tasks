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

    $serviceConnectionName = Get-VstsInput -Name serviceConnectionName -Require
    $connectedServiceEndpoint = Get-VstsEndpoint -Name $serviceConnectionName -Require

    $publishProfile = Read-PublishProfile $publishProfilePath
    $clusterConnectionParameters = $publishProfile.ClusterConnectionParameters
    
    $regKey = "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK"
    if (!(Test-Path $regKey))
    {
        throw (Get-VstsLocString -Key ServiceFabricSDKNotInstalled)
    }

    # Configure cluster connection pre-reqs and validate that the auth type configured by the service endpoint matches the auth type used by the publish profile.
    if ($connectedServiceEndpoint.Auth.Scheme -eq "UserNamePassword")
    {
        if (-not $clusterConnectionParameters.ContainsKey("AzureActiveDirectory") -or $clusterConnectionParameters.Item("AzureActiveDirectory") -eq $false)
        {
            throw (Get-VstsLocString -Key ClusterSecurityMismatch_AAD)
        }

        $securityToken = Get-AadSecurityToken -ClusterConnectionParameters $clusterConnectionParameters -ConnectedServiceEndpoint $connectedServiceEndpoint
        $clusterConnectionParameters["SecurityToken"] = $securityToken
        $clusterConnectionParameters["WarningAction"] = "SilentlyContinue"
    }
    elseif ($connectedServiceEndpoint.Auth.Scheme -eq "Certificate")
    {
        if (-not $clusterConnectionParameters.ContainsKey("X509Credential") -or $clusterConnectionParameters.Item("X509Credential") -eq $false)
        {
            throw (Get-VstsLocString -Key ClusterSecurityMismatch_Certificate)
        }

        Add-Certificate -ClusterConnectionParameters $clusterConnectionParameters -ConnectedServiceEndpoint $connectedServiceEndpoint
    }
    else
    {
        if ($clusterConnectionParameters.AzureActiveDirectory -or $clusterConnectionParameters.X509Credential) 
        {
            throw (Get-VstsLocString -Key ClusterSecurityMismatch_None)
        }
    }

    # Connect to cluster
    [void](Connect-ServiceFabricCluster @clusterConnectionParameters)
    Write-Host (Get-VstsLocString -Key ConnectedToCluster)
    
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