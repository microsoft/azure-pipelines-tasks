function Publish-UpgradedServiceFabricApplication
{
    <#
    .SYNOPSIS
    Publishes and starts an upgrade for an existing Service Fabric application in Service Fabric cluster.

    .DESCRIPTION
    This script registers & starts an upgrade for Service Fabric application.

    .NOTES
    Connection to service fabric cluster should be established by using 'Connect-ServiceFabricCluster' before invoking this cmdlet.

    .PARAMETER ApplicationPackagePath
    Path to the folder containing the Service Fabric application package OR path to the zipped service fabric applciation package.

    .PARAMETER ApplicationParameterFilePath
    Path to the application parameter file which contains Application Name and application parameters to be used for the application.

    .PARAMETER ApplicationName
    Name of Service Fabric application to be created. If value for this parameter is provided alongwith ApplicationParameterFilePath it will override the Application name specified in ApplicationParameter file.

    .PARAMETER Action
    Action which this script performs. Available Options are Register, Upgrade, RegisterAndUpgrade. Default Action is RegisterAndUpgrade.

    .PARAMETER ApplicationParameter
    Hashtable of the Service Fabric application parameters to be used for the application. If value for this parameter is provided, it will be merged with application parameters
    specified in ApplicationParameter file. In case a parameter is found ina pplication parameter file and on commandline, commandline parameter will override the one specified in application parameter file.

    .PARAMETER UpgradeParameters
    Hashtable of the upgrade parameters to be used for this upgrade. If Upgrade parameters are not specified then script will perform an UnmonitoredAuto upgrade.

    .PARAMETER UnregisterUnusedVersions
    Switch signalling if older vesions of the application need to be unregistered after upgrade.

    .PARAMETER SkipPackageValidation
    Switch signaling whether the package should be validated or not before deployment.

    .PARAMETER CopyPackageTimeoutSec
    Timeout in seconds for copying application package to image store.

    .PARAMETER RegisterPackageTimeoutSec
    Timeout in seconds for registering application package.

    .PARAMETER UnregisterPackageTimeoutSec
    Timeout in seconds for un-registering application package.

    .PARAMETER CompressPackage
    Indicates whether the application package should be compressed before copying to the image store.

    .PARAMETER SkipUpgradeSameTypeAndVersion
    Indicates whether an upgrade will be skipped if the same application type and version already exists in the cluster, otherwise the upgrade fails during validation.

    .EXAMPLE
    Publish-UpgradeServiceFabricApplication -ApplicationPackagePath 'pkg\Debug' -ApplicationParameterFilePath 'AppParameters.Local.xml'

    Registers & Upgrades an application with AppParameter file containing name of application and values for parameters that are defined in the application manifest.

    Publish-UpgradesServiceFabricApplication -ApplicationPackagePath 'pkg\Debug' -ApplicationName 'fabric:/Application1'

    Registers & Upgrades an application with the specified applciation name.

    #>

    [CmdletBinding(DefaultParameterSetName = "ApplicationName")]
    Param
    (
        [Parameter(Mandatory = $true, ParameterSetName = "ApplicationParameterFilePath")]
        [Parameter(Mandatory = $true, ParameterSetName = "ApplicationName")]
        [String]$ApplicationPackagePath,

        [Parameter(Mandatory = $true, ParameterSetName = "ApplicationParameterFilePath")]
        [String]$ApplicationParameterFilePath,

        [Parameter(Mandatory = $true, ParameterSetName = "ApplicationName")]
        [String]$ApplicationName,

        [Parameter(ParameterSetName = "ApplicationParameterFilePath")]
        [Parameter(ParameterSetName = "ApplicationName")]
        [ValidateSet('Register', 'Upgrade', 'RegisterAndUpgrade')]
        [String]$Action = 'RegisterAndUpgrade',

        [Parameter(ParameterSetName = "ApplicationParameterFilePath")]
        [Parameter(ParameterSetName = "ApplicationName")]
        [Hashtable]$ApplicationParameter,

        [Parameter(ParameterSetName = "ApplicationParameterFilePath")]
        [Parameter(ParameterSetName = "ApplicationName")]
        [Hashtable]$UpgradeParameters = @{UnmonitoredAuto = $true},

        [Parameter(ParameterSetName = "ApplicationParameterFilePath")]
        [Parameter(ParameterSetName = "ApplicationName")]
        [Switch]$UnregisterUnusedVersions,

        [Parameter(ParameterSetName = "ApplicationParameterFilePath")]
        [Parameter(ParameterSetName = "ApplicationName")]
        [Switch]$SkipPackageValidation,

        [Parameter(ParameterSetName = "ApplicationParameterFilePath")]
        [Parameter(ParameterSetName = "ApplicationName")]
        [int]$CopyPackageTimeoutSec,

        [Parameter(ParameterSetName = "ApplicationParameterFilePath")]
        [Parameter(ParameterSetName = "ApplicationName")]
        [int]$RegisterPackageTimeoutSec,

        [Parameter(ParameterSetName = "ApplicationParameterFilePath")]
        [Parameter(ParameterSetName = "ApplicationName")]
        [int]$UnregisterPackageTimeoutSec = 120,

        [Parameter(ParameterSetName = "ApplicationParameterFilePath")]
        [Parameter(ParameterSetName = "ApplicationName")]
        [Switch]$CompressPackage,

        [Parameter(ParameterSetName = "ApplicationParameterFilePath")]
        [Parameter(ParameterSetName = "ApplicationName")]
        [Switch]$SkipUpgradeSameTypeAndVersion
    )

    if (!(Test-Path -LiteralPath $ApplicationPackagePath))
    {
        $errMsg = (Get-VstsLocString -Key PathDoesNotExist -ArgumentList $ApplicationPackagePath)
        throw $errMsg
    }

    if (Test-Path -LiteralPath $ApplicationPackagePath -PathType Leaf)
    {
        if ((Get-Item -LiteralPath $ApplicationPackagePath).Extension -eq ".sfpkg")
        {
            $AppPkgPathToUse = [io.path]::combine((Get-TempDirectoryPath), (Get-Item -LiteralPath $ApplicationPackagePath).BaseName)
            Expand-ToFolder $ApplicationPackagePath $AppPkgPathToUse
        }
        else
        {
            $errMsg = (Get-VstsLocString -Key SFSDK_InvalidSFPackage -ArgumentList $ApplicationPackagePath)
            throw $errMsg
        }
    }
    else
    {
        $AppPkgPathToUse = $ApplicationPackagePath
    }

    if ($PSBoundParameters.ContainsKey('ApplicationParameterFilePath') -and !(Test-Path -LiteralPath $ApplicationParameterFilePath -PathType Leaf))
    {
        $errMsg = (Get-VstsLocString -Key PathDoesNotExist -ArgumentList $ApplicationParameterFilePath)
        throw $errMsg
    }

    $ApplicationManifestPath = "$AppPkgPathToUse\ApplicationManifest.xml"

    $names = Get-NamesFromApplicationManifest -ApplicationManifestPath $ApplicationManifestPath
    if (!$names)
    {
        return
    }

    # If ApplicationName is not specified on command line get application name from Application parameter file.
    if (!$ApplicationName)
    {
        $ApplicationName = Get-ApplicationNameFromApplicationParameterFile $ApplicationParameterFilePath
    }

    if (!$ApplicationName)
    {
        Write-Error (Get-VstsLocString -Key EmptyApplicationName)
    }

    $oldApplication = Get-ServiceFabricApplicationAction -ApplicationName $ApplicationName
    ## Check existence of the application
    if (!$oldApplication)
    {
        $errMsg = (Get-VstsLocString -Key SFSDK_AppDoesNotExist -ArgumentList $ApplicationName)
        throw $errMsg
    }

    if ($oldApplication.ApplicationTypeName -ne $names.ApplicationTypeName)
    {
        $errMsg = (Get-VstsLocString -Key SFSDK_AppTypeMismatch -ArgumentList $ApplicationName)
        throw $errMsg
    }

    if ($SkipUpgradeSameTypeAndVersion -And $oldApplication.ApplicationTypeVersion -eq $names.ApplicationTypeVersion)
    {
        Write-Warning (Get-VstsLocString -Key SFSDK_SkipUpgradeWarning -ArgumentList @($names.ApplicationTypeName, $names.ApplicationTypeVersion))
        return
    }

    Test-ServiceFabricClusterConnectionAction

    $ApplicationTypeAlreadyRegistered = $false
    if ($Action.Equals('RegisterAndUpgrade') -or $Action.Equals('Register'))
    {
        ## Check upgrade status
        $upgradeStatus = Get-ServiceFabricApplicationUpgradeAction -ApplicationName $ApplicationName
        if ($upgradeStatus.UpgradeState -ne "RollingBackCompleted" -and $upgradeStatus.UpgradeState -ne "RollingForwardCompleted" -and $upgradeStatus.UpgradeState -ne "Failed")
        {
            $errMsg = (Get-VstsLocString -Key SFSDK_UpgradeInProgressError -ArgumentList $ApplicationName)
            throw $errMsg
        }

        $reg = Get-ServiceFabricApplicationTypeAction -ApplicationTypeName $names.ApplicationTypeName | Where-Object { $_.ApplicationTypeVersion -eq $names.ApplicationTypeVersion }
        if ($reg)
        {
            $ApplicationTypeAlreadyRegistered = $true
            $typeIsInUse = $false
            $apps = Get-ServiceFabricApplicationAction -ApplicationTypeName $names.ApplicationTypeName
            $apps | ForEach-Object {
                if (($_.ApplicationTypeVersion -eq $names.ApplicationTypeVersion))
                {
                    $typeIsInUse = $true
                }
            }
            if (!$typeIsInUse)
            {
                Write-Host (Get-VstsLocString -Key SFSDK_UnregisteringExistingAppType -ArgumentList @($names.ApplicationTypeName, $names.ApplicationTypeVersion))
                Unregister-ServiceFabricApplicationTypeAction -ApplicationTypeName $($reg.ApplicationTypeName) -ApplicationTypeVersion $($reg.ApplicationTypeVersion) -TimeoutSec $UnregisterPackageTimeoutSec
                $ApplicationTypeAlreadyRegistered = $false
            }
            else
            {
                Write-Warning (Get-VstsLocString -Key SFSDK_SkipUnregisteringExistingAppType -ArgumentList @($names.ApplicationTypeName, $names.ApplicationTypeVersion))
            }
        }

        if (!$reg -or !$ApplicationTypeAlreadyRegistered)
        {
            # Get image store connection string
            $clusterManifestText = Get-ServiceFabricClusterManifestAction
            $imageStoreConnectionString = Get-ImageStoreConnectionStringFromClusterManifest ([xml] $clusterManifestText)

            if (!$SkipPackageValidation)
            {
                $packageValidationSuccess = (Test-ServiceFabricApplicationPackageAction -AppPkgPath $AppPkgPathToUse -ImageStoreConnectionString $imageStoreConnectionString)
                if (!$packageValidationSuccess)
                {
                    $errMsg = (Get-VstsLocString -Key SFSDK_PackageValidationFailed -ArgumentList $ApplicationPackagePath)
                    throw $errMsg
                }
            }

            $applicationPackagePathInImageStore = $names.ApplicationTypeName
            Write-Host (Get-VstsLocString -Key SFSDK_CopyingAppToImageStore)

            $copyParameters = @{
                'ApplicationPackagePath'             = $AppPkgPathToUse
                'ImageStoreConnectionString'         = $imageStoreConnectionString
                'ApplicationPackagePathInImageStore' = $applicationPackagePathInImageStore
            }

            $InstalledSdkVersion = [version](Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK" -Name FabricSDKVersion).FabricSDKVersion

            if ($CopyPackageTimeoutSec)
            {
                if ($InstalledSdkVersion -ge [version]"2.3")
                {
                    $copyParameters['TimeOutSec'] = $CopyPackageTimeoutSec
                }
                else
                {
                    Write-Warning (Get-VstsLocString -Key SFSDK_CopyPackageTimeoutSecWarning $InstalledSdkVersion)
                }
            }

            if ($CompressPackage)
            {
                if ($InstalledSdkVersion -ge [version]"2.5")
                {
                    $copyParameters['CompressPackage'] = $CompressPackage
                }
                else
                {
                    Write-Warning (Get-VstsLocString -Key SFSDK_CompressPackageWarning $InstalledSdkVersion)
                }
            }

            Copy-ServiceFabricApplicationPackageAction -CopyParameters $copyParameters

            $registerParameters = @{
                'ApplicationPathInImageStore' = $applicationPackagePathInImageStore
            }

            Write-Host (Get-VstsLocString -Key SFSDK_RegisterAppType)
            Register-ServiceFabricApplicationTypeAction -RegisterParameters $registerParameters -ApplicationTypeName $names.ApplicationTypeName -ApplicationTypeVersion $names.ApplicationTypeVersion -TimeoutSec $RegisterPackageTimeoutSec
        }
    }

    if ($Action.Equals('Upgrade') -or $Action.Equals('RegisterAndUpgrade'))
    {
        try
        {
            $UpgradeParameters["ApplicationName"] = $ApplicationName
            $UpgradeParameters["ApplicationTypeVersion"] = $names.ApplicationTypeVersion

            # If application parameters file is specified read values from and merge it with parameters passed on Commandline
            if ($PSBoundParameters.ContainsKey('ApplicationParameterFilePath'))
            {
                $appParamsFromFile = Get-ApplicationParametersFromApplicationParameterFile $ApplicationParameterFilePath
                if (!$ApplicationParameter)
                {
                    $ApplicationParameter = $appParamsFromFile
                }
                else
                {
                    $ApplicationParameter = Merge-Hashtables -HashTableOld $appParamsFromFile -HashTableNew $ApplicationParameter
                }
            }

            $UpgradeParameters["ApplicationParameter"] = $ApplicationParameter

            $serviceTypeHealthPolicyMap = $UpgradeParameters["ServiceTypeHealthPolicyMap"]
            if ($serviceTypeHealthPolicyMap -and $serviceTypeHealthPolicyMap -is [string])
            {
                $UpgradeParameters["ServiceTypeHealthPolicyMap"] = Invoke-Expression $serviceTypeHealthPolicyMap
            }

            Write-Host (Get-VstsLocString -Key SFSDK_StartAppUpgrade)
            Start-ServiceFabricApplicationUpgradeAction -UpgradeParameters $UpgradeParameters
        }
        catch
        {
            Write-Host (Get-VstsLocString -Key SFSDK_StartUpgradeFailed -ArgumentList $_.Exception.Message)
            try
            {
                if (!$ApplicationTypeAlreadyRegistered)
                {
                    Write-Host (Get-VstsLocString -Key SFSDK_UnregisterAppTypeOnUpgradeFailure -ArgumentList @($names.ApplicationTypeName, $names.ApplicationTypeVersion))
                    Unregister-ServiceFabricApplicationTypeAction -ApplicationTypeName $names.ApplicationTypeName -ApplicationTypeVersion $names.ApplicationTypeVersion -TimeoutSec $UnregisterPackageTimeoutSec
                }
            }
            catch
            {
                # just log this error
                Write-Warning (Get-VstsLocString -Key SFSDK_UnregisterAppTypeFailed -ArgumentList $_.Exception.Message)
            }

            throw
        }

        if (!$UpgradeParameters["Monitored"] -and !$UpgradeParameters["UnmonitoredAuto"])
        {
            return
        }

        $upgradeStatus = Wait-ServiceFabricApplicationUpgradeAction -ApplicationName $ApplicationName

        if ($UnregisterUnusedVersions)
        {
            Write-Host (Get-VstsLocString -Key SFSDK_UnregisterUnusedVersions)
            foreach ($registeredAppType in Get-ServiceFabricApplicationTypeAction -ApplicationTypeName $names.ApplicationTypeName)
            {
                try
                {
                    Unregister-ServiceFabricApplicationTypeAction -ApplicationTypeName $($registeredAppType.ApplicationTypeName) -ApplicationTypeVersion $($registeredAppType.ApplicationTypeVersion) -TimeoutSec $UnregisterPackageTimeoutSec
                }
                catch
                {
                    # AppType and Version in use.
                }
            }
        }

        if ($upgradeStatus.UpgradeState -eq "RollingForwardCompleted")
        {
            Write-Host (Get-VstsLocString -Key SFSDK_UpgradeSuccess)
        }
        elseif ($upgradeStatus.UpgradeState -eq "RollingBackCompleted")
        {
            $global:operationId = $SF_Operations.WaitApplicationUpgradeStatus

            Trace-ServiceFabricApplicationHealth -ApplicationName $ApplicationName
            Trace-ServiceFabricClusterHealth

            Write-Error (Get-VstsLocString -Key SFSDK_UpgradeRolledBack)
        }
        elseif($upgradeStatus.UpgradeState -eq "Failed")
        {
            Write-Error "Upgrade Failed."
        }
    }
}
