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

    $publishProfilePath = Get-SinglePathOfType (Get-VstsInput -Name publishProfilePath) Leaf
    if ($publishProfilePath)
    {
        $publishProfile = Read-PublishProfile $publishProfilePath
    }

    $applicationPackagePath = Get-SinglePathOfType (Get-VstsInput -Name applicationPackagePath -Require) Container -Require

    $serviceConnectionName = Get-VstsInput -Name serviceConnectionName -Require
    $connectedServiceEndpoint = Get-VstsEndpoint -Name $serviceConnectionName -Require

    $clusterConnectionParameters = @{}
    
    $regKey = "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK"
    if (!(Test-Path $regKey))
    {
        throw (Get-VstsLocString -Key ServiceFabricSDKNotInstalled)
    }

    $connectionEndpointUrl = [System.Uri]$connectedServiceEndpoint.url
    # Override the publish profile's connection endpoint with the one defined on the associated service endpoint
    $clusterConnectionParameters["ConnectionEndpoint"] = $connectionEndpointUrl.Authority # Authority includes just the hostname and port

    # Configure cluster connection pre-reqs
    if ($connectedServiceEndpoint.Auth.Scheme -ne "None")
    {
        # Add server cert thumbprint (common to both auth-types)
        if ($ConnectedServiceEndpoint.Auth.Parameters.ServerCertThumbprint)
        {
            $clusterConnectionParameters["ServerCertThumbprint"] = $ConnectedServiceEndpoint.Auth.Parameters.ServerCertThumbprint
        }
        else
        {
            Write-Warning (Get-VstsLocString -Key ServiceEndpointUpgradeWarning)
            if ($publishProfile)
            {
                $clusterConnectionParameters["ServerCertThumbprint"] = $publishProfile.ClusterConnectionParameters["ServerCertThumbprint"]
            }
            else
            {
                throw (Get-VstsLocString -Key PublishProfileRequiredServerThumbprint)
            }
        }

        # Add auth-specific parameters
        if ($connectedServiceEndpoint.Auth.Scheme -eq "UserNamePassword")
        {
            # Setup the AzureActiveDirectory and ServerCertThumbprint parameters before getting the security token, because getting the security token
            # requires a connection request to the cluster in order to get metadata and so these two parameters are needed for that request.
            $clusterConnectionParameters["AzureActiveDirectory"] = $true

            $securityToken = Get-AadSecurityToken -ClusterConnectionParameters $clusterConnectionParameters -ConnectedServiceEndpoint $connectedServiceEndpoint
            $clusterConnectionParameters["SecurityToken"] = $securityToken
            $clusterConnectionParameters["WarningAction"] = "SilentlyContinue"
        }
        elseif ($connectedServiceEndpoint.Auth.Scheme -eq "Certificate")
        {
            Add-Certificate -ClusterConnectionParameters $clusterConnectionParameters -ConnectedServiceEndpoint $connectedServiceEndpoint
            $clusterConnectionParameters["X509Credential"] = $true
        }
    }

    # Connect to cluster
    try {
        [void](Connect-ServiceFabricCluster @clusterConnectionParameters)
    }
    catch {
        if ($connectionEndpointUrl.Port -ne "19000") {
            Write-Warning (Get-VstsLocString -Key DefaultPortWarning $connectionEndpointUrl.Port)
        }

        throw $_
    }
    
    Write-Host (Get-VstsLocString -Key ConnectedToCluster)
    
    . "$PSScriptRoot\ServiceFabricSDK\ServiceFabricSDK.ps1"

    $applicationParameterFile = Get-SinglePathOfType (Get-VstsInput -Name applicationParameterPath) Leaf
    if ($applicationParameterFile)
    {
        Write-Host (Get-VstsLocString -Key OverrideApplicationParameterFile -ArgumentList $applicationParameterFile) 
    }
    elseif ($publishProfile)
    {
        $applicationParameterFile = $publishProfile.ApplicationParameterFile
        Assert-VstsPath -LiteralPath $applicationParameterFile -PathType Leaf
    }
    else
    {
        throw (Get-VstsLocString -Key PublishProfileRequiredAppParams)
    }

    if ((Get-VstsInput -Name overridePublishProfileSettings) -eq "true")
    {
        Write-Host (Get-VstsLocString -Key OverrideUpgradeSettings)
        $isUpgrade = (Get-VstsInput -Name isUpgrade) -eq "true"

        if ($isUpgrade)
        {
            $upgradeParameters = Get-VstsUpgradeParameters
        }
    }
    elseif ($publishProfile)
    {
        $isUpgrade = $publishProfile.UpgradeDeployment -and $publishProfile.UpgradeDeployment.Enabled
        $upgradeParameters = $publishProfile.UpgradeDeployment.Parameters
    }
    else
    {
        throw (Get-VstsLocString -Key PublishProfileRequiredUpgrade)
    }

    $applicationName = Get-ApplicationNameFromApplicationParameterFile $applicationParameterFile
    $app = Get-ServiceFabricApplication -ApplicationName $applicationName
    
    # Do an upgrade if configured to do so and the app actually exists
    if ($isUpgrade -and $app)
    {
        Publish-UpgradedServiceFabricApplication -ApplicationPackagePath $applicationPackagePath -ApplicationParameterFilePath $applicationParameterFile -Action RegisterAndUpgrade -UpgradeParameters $upgradeParameters -UnregisterUnusedVersions -ErrorAction Stop
    }
    else
    {
        Publish-NewServiceFabricApplication -ApplicationPackagePath $ApplicationPackagePath -ApplicationParameterFilePath $applicationParameterFile -Action RegisterAndCreate -OverwriteBehavior SameAppTypeAndVersion -ErrorAction Stop 
    }
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}