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
    Import-Module $PSScriptRoot\ps_modules\ServiceFabricHelpers

    # Collect input values

    $publishProfilePath = Get-SinglePathOfType (Get-VstsInput -Name publishProfilePath) Leaf
    if ($publishProfilePath)
    {
        $publishProfile = Read-PublishProfile $publishProfilePath
    }

    $applicationPackagePath = Get-SinglePathOfType (Get-VstsInput -Name applicationPackagePath -Require) Container -Require

    $serviceConnectionName = Get-VstsInput -Name serviceConnectionName -Require
    $connectedServiceEndpoint = Get-VstsEndpoint -Name $serviceConnectionName -Require

    $copyPackageTimeoutSec = Get-VstsInput -Name copyPackageTimeoutSec
    $registerPackageTimeoutSec = Get-VstsInput -Name registerPackageTimeoutSec
    $compressPackage = [System.Boolean]::Parse((Get-VstsInput -Name compressPackage))
    $skipUpgrade =  [System.Boolean]::Parse((Get-VstsInput -Name skipUpgradeSameTypeAndVersion))

    $clusterConnectionParameters = @{}

    if ($connectedServiceEndpoint.Auth.Scheme -ne "None" -and !$connectedServiceEndpoint.Auth.Parameters.ServerCertThumbprint)
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

    # Connect to cluster
    Connect-ServiceFabricClusterFromServiceEndpoint -ClusterConnectionParameters $clusterConnectionParameters -ConnectedServiceEndpoint $connectedServiceEndpoint

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

    $publishParameters = @{
        'ApplicationPackagePath' = $applicationPackagePath
        'ApplicationParameterFilePath' = $applicationParameterFile
        'ErrorAction' = "Stop"
    }

    if ($publishProfile.CopyPackageParameters)
    {
        if ($publishProfile.CopyPackageParameters.CompressPackage)
        {
            $publishParameters['CompressPackage'] = [System.Boolean]::Parse($publishProfile.CopyPackageParameters.CompressPackage)
        }

        if ($publishProfile.CopyPackageParameters.CopyPackageTimeoutSec)
        {
            $publishParameters['CopyPackageTimeoutSec'] = $publishProfile.CopyPackageParameters.CopyPackageTimeoutSec
        }
    }

    # compressPackage task input overrides the publish profile if it's enabled.
    if ($compressPackage)
    {
        $publishParameters['CompressPackage'] = $compressPackage
    }

    # copyPackageTimeoutSec task input overrides the publish profile if it's set.
    if ($copyPackageTimeoutSec)
    {
        $publishParameters['CopyPackageTimeoutSec'] = $copyPackageTimeoutSec
    }

    # registerPackageTimeoutSec task input overrides the publish profile if it's enabled
    if ($registerPackageTimeoutSec)
    {
        $publishParameters['RegisterPackageTimeoutSec'] = $registerPackageTimeoutSec
    }

    # Do an upgrade if configured to do so and the app actually exists
    if ($isUpgrade -and $app)
    {
        $publishParameters['Action'] = "RegisterAndUpgrade"
        $publishParameters['UpgradeParameters'] = $upgradeParameters
        $publishParameters['UnregisterUnusedVersions'] = $true        
        $publishParameters['SkipUpgradeSameTypeAndVersion'] = $skipUpgrade

        Publish-UpgradedServiceFabricApplication @publishParameters
    }
    else
    {
        $publishParameters['Action'] = "RegisterAndCreate"
        $publishParameters['OverwriteBehavior'] = Get-VstsInput -Name overwriteBehavior

        Publish-NewServiceFabricApplication @publishParameters
    }
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}