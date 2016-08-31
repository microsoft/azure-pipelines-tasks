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

    .EXAMPLE
    Publish-UpgradeServiceFabricApplication -ApplicationPackagePath 'pkg\Debug' -ApplicationParameterFilePath 'AppParameters.Local.xml'

    Registers & Upgrades an application with AppParameter file containing name of application and values for parameters that are defined in the application manifest.

    Publish-UpgradesServiceFabricApplication -ApplicationPackagePath 'pkg\Debug' -ApplicationName 'fabric:/Application1'

    Registers & Upgrades an application with the specified applciation name.

    #>

    [CmdletBinding(DefaultParameterSetName="ApplicationName")]  
    Param
    (
        [Parameter(Mandatory=$true,ParameterSetName="ApplicationParameterFilePath")]
        [Parameter(Mandatory=$true,ParameterSetName="ApplicationName")]
        [String]$ApplicationPackagePath,

        [Parameter(Mandatory=$true,ParameterSetName="ApplicationParameterFilePath")]
        [String]$ApplicationParameterFilePath,

        [Parameter(Mandatory=$true,ParameterSetName="ApplicationName")]
        [String]$ApplicationName,

        [Parameter(ParameterSetName="ApplicationParameterFilePath")]
        [Parameter(ParameterSetName="ApplicationName")]
        [ValidateSet('Register','Upgrade','RegisterAndUpgrade')]
        [String]$Action = 'RegisterAndUpgrade',

        [Parameter(ParameterSetName="ApplicationParameterFilePath")]
        [Parameter(ParameterSetName="ApplicationName")]
        [Hashtable]$ApplicationParameter,

        [Parameter(ParameterSetName="ApplicationParameterFilePath")]
        [Parameter(ParameterSetName="ApplicationName")]
        [Hashtable]$UpgradeParameters = @{UnmonitoredAuto = $true},

        [Parameter(ParameterSetName="ApplicationParameterFilePath")]
        [Parameter(ParameterSetName="ApplicationName")]
        [Switch]$UnregisterUnusedVersions,

        [Parameter(ParameterSetName="ApplicationParameterFilePath")]
        [Parameter(ParameterSetName="ApplicationName")]
        [Switch]$SkipPackageValidation
    )


    if (!(Test-Path $ApplicationPackagePath))
    {
        $errMsg = (Get-VstsLocString -Key PathDoesNotExist -ArgumentList $ApplicationPackagePath)
        throw $errMsg
    }

    if (Test-Path $ApplicationPackagePath -PathType Leaf)
    {
        if((Get-Item $ApplicationPackagePath).Extension -eq ".sfpkg")
        {
            $AppPkgPathToUse=[io.path]::combine($env:Temp, (Get-Item $ApplicationPackagePath).BaseName)
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

    if ($PSBoundParameters.ContainsKey('ApplicationParameterFilePath') -and !(Test-Path $ApplicationParameterFilePath -PathType Leaf))
    {
        $errMsg = (Get-VstsLocString -Key PathDoesNotExist -ArgumentList $ApplicationParameterFilePath)
        throw $errMsg
    }

	# Get image store connection string
    $clusterManifestText = Get-ServiceFabricClusterManifest
	$imageStoreConnectionString = Get-ImageStoreConnectionStringFromClusterManifest ([xml] $clusterManifestText)

    if(!$SkipPackageValidation)
    {
        $packageValidationSuccess = (Test-ServiceFabricApplicationPackage $AppPkgPathToUse -ImageStoreConnectionString $imageStoreConnectionString)
        if (!$packageValidationSuccess)
        {
           $errMsg = (Get-VstsLocString -Key SFSDK_PackageValidationFailed -ArgumentList $ApplicationPackagePath)
           throw $errMsg
        }
    }

    $ApplicationManifestPath = "$AppPkgPathToUse\ApplicationManifest.xml"    

    try
    {
        [void](Test-ServiceFabricClusterConnection)
    }
    catch
    {
        Write-Warning (Get-VstsLocString -Key SFSDK_UnableToVerifyClusterConnection)
        throw
    }

    # If ApplicationName is not specified on command line get application name from Application parameter file.
    if(!$ApplicationName)
    {
       $ApplicationName = Get-ApplicationNameFromApplicationParameterFile $ApplicationParameterFilePath
    }

    $names = Get-NamesFromApplicationManifest -ApplicationManifestPath $ApplicationManifestPath
    if (!$names)
    {
        return
    }

    if ($Action.Equals('RegisterAndUpgrade') -or $Action.Equals('Register'))
    {    
        ## Check existence of the application
        $oldApplication = Get-ServiceFabricApplication -ApplicationName $ApplicationName
        
        if (!$oldApplication)
        {
            $errMsg = (Get-VstsLocString -Key SFSDK_AppDoesNotExist -ArgumentList $ApplicationName)
            throw $errMsg
        }
        else
        {
            if($oldApplication.ApplicationTypeName -ne $names.ApplicationTypeName)
            {   
                $errMsg = (Get-VstsLocString -Key SFSDK_AppTypeMismatch -ArgumentList $ApplicationName)
                throw $errMsg
            }
        }                
    
        ## Check upgrade status
        $upgradeStatus = Get-ServiceFabricApplicationUpgrade -ApplicationName $ApplicationName
        if ($upgradeStatus.UpgradeState -ne "RollingBackCompleted" -and $upgradeStatus.UpgradeState -ne "RollingForwardCompleted")
        {
            $errMsg = (Get-VstsLocString -Key SFSDK_UpgradeInProgressError -ArgumentList $ApplicationName)
            throw $errMsg
        }

        $reg = Get-ServiceFabricApplicationType -ApplicationTypeName $names.ApplicationTypeName | Where-Object  { $_.ApplicationTypeVersion -eq $names.ApplicationTypeVersion }
        if ($reg)
        {
            Write-Host (Get-VstsLocString -Key SFSDK_UnregisteringExistingAppType -ArgumentList @($names.ApplicationTypeName, $names.ApplicationTypeVersion))
            $reg | Unregister-ServiceFabricApplicationType -Force
        }
    
        $applicationPackagePathInImageStore = $names.ApplicationTypeName
        Write-Host (Get-VstsLocString -Key SFSDK_CopyingAppToImageStore)
        Copy-ServiceFabricApplicationPackage -ApplicationPackagePath $AppPkgPathToUse -ImageStoreConnectionString $imageStoreConnectionString -ApplicationPackagePathInImageStore $applicationPackagePathInImageStore
        if(!$?)
        {
            throw (Get-VstsLocString -Key SFSDK_CopyingAppToImageStoreFailed)
        }
    
        Write-Host (Get-VstsLocString -Key SFSDK_RegisterAppType)
        Register-ServiceFabricApplicationType -ApplicationPathInImageStore $applicationPackagePathInImageStore
        if(!$?)
        {
            throw Write-Host (Get-VstsLocString -Key SFSDK_RegisterAppTypeFailed)
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
                if(!$ApplicationParameter)
                {
                    $ApplicationParameter = $appParamsFromFile
                }
                else
                {
                    $ApplicationParameter = Merge-Hashtables -HashTableOld $appParamsFromFile -HashTableNew $ApplicationParameter
                }    
            }
     
            $UpgradeParameters["ApplicationParameter"] = $ApplicationParameter

            $serviceTypeHealthPolicyMap = $upgradeParameters["ServiceTypeHealthPolicyMap"]
            if ($serviceTypeHealthPolicyMap -and $serviceTypeHealthPolicyMap -is [string])
            {
                $upgradeParameters["ServiceTypeHealthPolicyMap"] = Invoke-Expression $serviceTypeHealthPolicyMap
            }
        
            Write-Host (Get-VstsLocString -Key SFSDK_StartAppUpgrade) 
            Start-ServiceFabricApplicationUpgrade @UpgradeParameters
        }
        catch
        {
            Write-Host (Get-VstsLocString -Key SFSDK_UnregisterAppTypeOnUpgradeFailure -ArgumentList @($names.ApplicationTypeName, $names.ApplicationTypeVersion))
            Unregister-ServiceFabricApplicationType -ApplicationTypeName $names.ApplicationTypeName -ApplicationTypeVersion $names.ApplicationTypeVersion -Force
            throw
        }

        if (!$UpgradeParameters["Monitored"] -and !$UpgradeParameters["UnmonitoredAuto"])
        {
            return
        }
    
        do
        {
            Write-Host (Get-VstsLocString -Key SFSDK_WaitingForUpgrade)
            Start-Sleep -Seconds 3
            $upgradeStatus = Get-ServiceFabricApplicationUpgrade -ApplicationName $ApplicationName
        } while ($upgradeStatus.UpgradeState -ne "RollingBackCompleted" -and $upgradeStatus.UpgradeState -ne "RollingForwardCompleted")
    
        if($UnregisterUnusedVersions)
        {
            Write-Host (Get-VstsLocString -Key SFSDK_UnregisterUnusedVersions)
            foreach($registeredAppTypes in Get-ServiceFabricApplicationType -ApplicationTypeName $names.ApplicationTypeName | Where-Object  { $_.ApplicationTypeVersion -ne $names.ApplicationTypeVersion })
            {
                try
                {
                    $registeredAppTypes | Unregister-ServiceFabricApplicationType -Force
                }
                catch [System.Fabric.FabricException]
                {
                    # AppType and Version in use.
                }
            }
        }

        if($upgradeStatus.UpgradeState -eq "RollingForwardCompleted")
        {
            Write-Host (Get-VstsLocString -Key SFSDK_UpgradeSuccess)
        }
        elseif($upgradeStatus.UpgradeState -eq "RollingBackCompleted")
        {
            Write-Host (Get-VstsLocString -Key SFSDK_UpgradeRolledBack)
        }
    }
}