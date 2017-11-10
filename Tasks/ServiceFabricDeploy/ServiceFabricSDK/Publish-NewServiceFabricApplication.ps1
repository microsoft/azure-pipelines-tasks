function Publish-NewServiceFabricApplication
{
    <#
    .SYNOPSIS 
    Publishes a new Service Fabric application type to Service Fabric cluster.

    .DESCRIPTION
    This script registers & creates a Service Fabric application.

    .NOTES
    Connection to service fabric cluster should be established by using 'Connect-ServiceFabricCluster' before invoking this cmdlet.
    WARNING: This script creates a new Service Fabric application in the cluster. If OverwriteExistingApplication switch is provided, it deletes any existing application in the cluster with the same name.

    .PARAMETER ApplicationPackagePath
    Path to the folder containing the Service Fabric application package OR path to the zipped service fabric applciation package.

    .PARAMETER ApplicationParameterFilePath
    Path to the application parameter file which contains Application Name and application parameters to be used for the application.    

    .PARAMETER ApplicationName
    Name of Service Fabric application to be created. If value for this parameter is provided alongwith ApplicationParameterFilePath it will override the Application name specified in ApplicationParameter  file.

    .PARAMETER Action
    Action which this script performs. Available Options are Register, Create, RegisterAndCreate. Default Action is RegisterAndCreate.

    .PARAMETER ApplicationParameter
    Hashtable of the Service Fabric application parameters to be used for the application. If value for this parameter is provided, it will be merged with application parameters
    specified in ApplicationParameter file. In case a parameter is found in application parameter file and on commandline, commandline parameter will override the one specified in application parameter file.

    .PARAMETER OverwriteBehavior
    Overwrite Behavior if an application exists in the cluster with the same name. Available Options are Never, Always, SameAppTypeAndVersion. 
    Never will not remove the existing application. This is the default behavior.
    Always will remove the existing application even if its Application type and Version is different from the application being created. 
    SameAppTypeAndVersion will remove the existing application only if its Application type and Version is same as the application being created.

    .PARAMETER SkipPackageValidation
    Switch signaling whether the package should be validated or not before deployment.

    .PARAMETER CopyPackageTimeoutSec
    Timeout in seconds for copying application package to image store.

    .PARAMETER RegisterPackageTimeoutSec
    Timeout in seconds for registering application package.

    .PARAMETER CompressPackage
    Indicates whether the application package should be compressed before copying to the image store.

    .EXAMPLE
    Publish-NewServiceFabricApplication -ApplicationPackagePath 'pkg\Debug' -ApplicationParameterFilePath 'Local.xml'

    Registers & Creates an application with AppParameter file containing name of application and values for parameters that are defined in the application manifest.

    Publish-NewServiceFabricApplication -ApplicationPackagePath 'pkg\Debug' -ApplicationName 'fabric:/Application1'

    Registers & Creates an application with the specified application name.

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
        [Parameter(ParameterSetName="ApplicationParameterFilePath")]
        [String]$ApplicationName,

        [Parameter(ParameterSetName="ApplicationParameterFilePath")]
        [Parameter(ParameterSetName="ApplicationName")]
        [ValidateSet('Register','Create','RegisterAndCreate')]
        [String]$Action = 'RegisterAndCreate',

        [Parameter(ParameterSetName="ApplicationParameterFilePath")]
        [Parameter(ParameterSetName="ApplicationName")]
        [Hashtable]$ApplicationParameter,

        [Parameter(ParameterSetName="ApplicationParameterFilePath")]
        [Parameter(ParameterSetName="ApplicationName")]
        [ValidateSet('Never','Always','SameAppTypeAndVersion')]
        [String]$OverwriteBehavior = 'Never',

        [Parameter(ParameterSetName="ApplicationParameterFilePath")]
        [Parameter(ParameterSetName="ApplicationName")]
        [Switch]$SkipPackageValidation,

        [Parameter(ParameterSetName="ApplicationParameterFilePath")]
        [Parameter(ParameterSetName="ApplicationName")]
        [int]$CopyPackageTimeoutSec,

        [Parameter(ParameterSetName="ApplicationParameterFilePath")]
        [Parameter(ParameterSetName="ApplicationName")]
        [int]$RegisterPackageTimeoutSec,

        [Parameter(ParameterSetName="ApplicationParameterFilePath")]
        [Parameter(ParameterSetName="ApplicationName")]
        [Switch]$CompressPackage
    )


    if (!(Test-Path $ApplicationPackagePath))
    {
        $errMsg = (Get-VstsLocString -Key PathDoesNotExist -ArgumentList $ApplicationPackagePath)
        throw $errMsg
    }

    # Check if the ApplicationPackagePath points to a compressed package.
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

    if(!$SkipPackageValidation)
    {
        $packageValidationSuccess = (Test-ServiceFabricApplicationPackage $AppPkgPathToUse)
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

    # If ApplicationName is not specified on command line get application name from Application Parameter file.
    if(!$ApplicationName)
    {
       $ApplicationName = Get-ApplicationNameFromApplicationParameterFile $ApplicationParameterFilePath
    }

    if(!$ApplicationName)
    {
        Write-Error (Get-VstsLocString -Key EmptyApplicationName)
    }

    $names = Get-NamesFromApplicationManifest -ApplicationManifestPath $ApplicationManifestPath
    if (!$names)
    {
        Write-Warning (Get-VstsLocString -Key SFSDK_UnableToReadAppTypeAndVersion)
        return
    }

    if($Action.Equals("Register") -or $Action.Equals("RegisterAndCreate"))
    {
        # Apply OverwriteBehavior if an applciation with same name already exists.
        $app = Get-ServiceFabricApplication -ApplicationName $ApplicationName
        if ($app)
        {
            $removeApp = $false
            if($OverwriteBehavior.Equals("Never"))
            {
                $errMsg = (Get-VstsLocString -Key SFSDK_AppAlreadyExistsError -ArgumentList @($ApplicationName, $app.ApplicationTypeName, $app.ApplicationTypeVersion))
                throw $errMsg
            }

            if($OverwriteBehavior.Equals("SameAppTypeAndVersion")) 
            {
                if($app.ApplicationTypeVersion -eq $names.ApplicationTypeVersion -and $app.ApplicationTypeName -eq $names.ApplicationTypeName)
                {
                    $removeApp = $true
                }
                else
                {
                    $errMsg = (Get-VstsLocString -Key SFSDK_AppAlreadyExistsError -ArgumentList @($ApplicationName, $app.ApplicationTypeName, $app.ApplicationTypeVersion))
                    throw $errMsg
                }             
            }

            if($OverwriteBehavior.Equals("Always"))
            {
                $removeApp = $true
            }            

            if($removeApp)
            {
                Write-Host (Get-VstsLocString -Key SFSDK_AppAlreadyExistsInfo -ArgumentList @($ApplicationName, $app.ApplicationTypeName, $app.ApplicationTypeVersion))

                try
				{
				    $app | Remove-ServiceFabricApplication -Force
			    }
				catch [System.TimeoutException]
				{
					# Catch operation timeout and continue with force remove replica.
				}

                foreach ($node in Get-ServiceFabricNode)
                {
                    [void](Get-ServiceFabricDeployedReplica -NodeName $node.NodeName -ApplicationName $ApplicationName | Remove-ServiceFabricReplica -NodeName $node.NodeName -ForceRemove)
                }

                if($OverwriteBehavior.Equals("Always"))
                {                    
                    # Unregsiter AppType and Version if there are no other applciations for the Type and Version. 
                    # It will unregister the existing application's type and version even if its different from the application being created,
                    if((Get-ServiceFabricApplication | Where-Object {$_.ApplicationTypeVersion -eq $($app.ApplicationTypeVersion) -and $_.ApplicationTypeName -eq $($app.ApplicationTypeName)}).Count -eq 0)
                    {
                        Unregister-ServiceFabricApplicationType -ApplicationTypeName $($app.ApplicationTypeName) -ApplicationTypeVersion $($app.ApplicationTypeVersion) -Force
                    }
                }
            }
        }        

        $reg = Get-ServiceFabricApplicationType -ApplicationTypeName $names.ApplicationTypeName | Where-Object  { $_.ApplicationTypeVersion -eq $names.ApplicationTypeVersion }
        if ($reg)
        {
            Write-Host (Get-VstsLocString -Key SFSDK_UnregisteringExistingAppType -ArgumentList @($names.ApplicationTypeName, $names.ApplicationTypeVersion))
            $reg | Unregister-ServiceFabricApplicationType -Force
            if(!$?)
            {
                throw (Get-VstsLocString -Key SFSDK_UnableToUnregisterAppType)
            }
        }

        Write-Host (Get-VstsLocString -Key SFSDK_CopyingAppToImageStore)
        # Get image store connection string
        $clusterManifestText = Get-ServiceFabricClusterManifest
        $imageStoreConnectionString = Get-ImageStoreConnectionStringFromClusterManifest ([xml] $clusterManifestText)

        $applicationPackagePathInImageStore = $names.ApplicationTypeName
        $copyParameters = @{
            'ApplicationPackagePath' = $AppPkgPathToUse
            'ImageStoreConnectionString' = $imageStoreConnectionString
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

        Copy-ServiceFabricApplicationPackage @copyParameters
        if(!$?)
        {
            throw (Get-VstsLocString -Key SFSDK_CopyingAppToImageStoreFailed)
        }

        $registerParameters = @{
            'ApplicationPathInImageStore' = $applicationPackagePathInImageStore
        }
        
        if ($RegisterPackageTimeoutSec)
        {
            $registerParameters['TimeOutSec'] = $RegisterPackageTimeoutSec
        }

        Write-Host (Get-VstsLocString -Key SFSDK_RegisterAppType)
        Register-ServiceFabricApplicationType @registerParameters
        if(!$?)
        {
            throw (Get-VstsLocString -Key SFSDK_RegisterAppTypeFailed)
        }

        Write-Host (Get-VstsLocString -Key SFSDK_RemoveAppPackage)
        Remove-ServiceFabricApplicationPackage -ApplicationPackagePathInImageStore $applicationPackagePathInImageStore -ImageStoreConnectionString $imageStoreConnectionString
    }

    if($Action.Equals("Create") -or $Action.Equals("RegisterAndCreate"))
    {
        Write-Host (Get-VstsLocString -Key SFSDK_CreateApplication)

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
    
        New-ServiceFabricApplication -ApplicationName $ApplicationName -ApplicationTypeName $names.ApplicationTypeName -ApplicationTypeVersion $names.ApplicationTypeVersion -ApplicationParameter $ApplicationParameter
        if(!$?)
        {
            throw (Get-VstsLocString -Key SFSDK_CreateApplicationFailed)
        }

        Write-Host (Get-VstsLocString -Key SFSDK_CreateApplicationSuccess)
    }
}