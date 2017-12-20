function Create-DiffPackage
{
    [CmdletBinding()]
    param(
        [parameter(Mandatory=$true)][String] $ApplicationName,
        [parameter(Mandatory=$true)][String] $ApplicationPackagePath,
        [parameter(Mandatory=$true)] $ConnectedServiceEndpoint,
        [parameter(Mandatory=$true)][Hashtable] $ClusterConnectionParameters
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        Write-Host (Get-VstsLocString -Key DIFFPKG_CreatingDiffPackage)

        Import-Module $PSScriptRoot\ps_modules\ServiceFabricHelpers
        Import-Module $PSScriptRoot\ps_modules\PowershellHelpers

        $appManifestName = "ApplicationManifest.xml"
        $localAppManifestPath = Join-Path $ApplicationPackagePath $appManifestName
        $localAppManifestXml = [XML](Get-Content $localAppManifestPath)
        $applicationTypeName = $localAppManifestXml.ApplicationManifest.ApplicationTypeName
        $localAppTypeVersion = $localAppManifestXml.ApplicationManifest.ApplicationTypeVersion

        $app = Get-ServiceFabricApplication -ApplicationName $ApplicationName

        # If $app is null, it means the application does not exist in the cluster. Diff Package is equal to Full Package. Use Full Package to do deployment
        if (!$app -or $app.ApplicationTypeName -ne $applicationTypeName)
        {
            Write-Host (Get-VstsLocString -Key DIFFPKG_ApplicationDoesNotExist -ArgumentList @($ApplicationName, $ConnectedServiceEndpoint.Url))
            Return
        }

        $diffPackagePath = Join-Path (Get-VstsInput -Name diffPackagePath -Require) "DiffPackage"
        if (Test-Path -PathType Container -Path $diffPackagePath)
        {
            Remove-Item -Path $diffPackagePath -Recurse -Force
        }
        $diffPackagePath = New-Item -ItemType Directory -Path $diffPackagePath -Force
        $diffPkgAppManifestPath = Join-Path $diffPackagePath $appManifestName

        $clusterAppTypeVersion = $app.ApplicationTypeVersion

        # If the ApplicationTypeVersion of the Application is not upgraded, no diff package is made because there is no need
        if ($clusterAppTypeVersion -eq $localAppTypeVersion)
        {
            Write-Host (Get-VstsLocString -Key DIFFPKG_ApplicationIsNotChanged -ArgumentList @($ApplicationName, $clusterAppTypeVersion, $ConnectedServiceEndpoint.Url))
            Return
        }

        # Get the service types from the cluster
        $serviceTypes = Get-ServiceFabricServiceType -ApplicationTypeName $applicationTypeName -ApplicationTypeVersion $clusterAppTypeVersion
        # Pack the service manifest names into an array
        $clusterServiceManifestNames = $serviceTypes.ServiceManifestName

        # If $clusterServiceManifestNames is null, it means no service types are registered. Services can be registered without running but will still show up in this list in that case. 
        # Diff Package is equal to Full Package. Use Full Package to do deployment
        if (!$clusterServiceManifestNames)
        {
            Write-Host (Get-VstsLocString -Key DIFFPKG_NoServicesRunning -ArgumentList @($ApplicationName, $ConnectedServiceEndpoint.Url))
            Return
        }

        Write-Host (Get-VstsLocString -Key DIFFPKG_CopyingToDiffPackge -ArgumentList @($localAppManifestPath, $diffPkgAppManifestPath))
        Copy-Item $localAppManifestPath $diffPkgAppManifestPath -Force

        # Get the service manifests from the cluster
        $clusterServiceManifestByName = @{}
        foreach ($clusterServiceManifestName in $clusterServiceManifestNames)
        {
            $clusterServiceManifestContent = Get-ServiceFabricServiceManifest -ApplicationTypeName $applicationTypeName -ApplicationTypeVersion $clusterAppTypeVersion -ServiceManifestName $clusterServiceManifestName
            $clusterServiceManifestByName[$clusterServiceManifestName] = [XML]$clusterServiceManifestContent
        }

        foreach ($serviceManifestImport in $localAppManifestXml.ApplicationManifest.ServiceManifestImport)
        {
            # Open the service manifest associated with the current ServiceManifestImport element of the local ApplicationManifest
            $serviceManifestName = "ServiceManifest.xml"
            $localServicePkgPath = Join-Path $ApplicationPackagePath $serviceManifestImport.ServiceManifestRef.ServiceManifestName
            $localServiceManifestPath = [System.IO.Path]::Combine($localServicePkgPath, $serviceManifestName)
            $localServiceManifest = ([XML](Get-Content $localServiceManifestPath)).ServiceManifest
            $diffServicePkgPath = [System.IO.Path]::Combine($diffPackagePath, $localServiceManifest.Name)
            $clusterServiceManifest = $clusterServiceManifestByName[$localServiceManifest.Name].ServiceManifest

            # If there's no matching manifest from the cluster it means this is a newly added service that doesn't exist yet on the cluster. 
            if (!$clusterServiceManifest)
            {
                # Copy this service and all the children
                Write-Host (Get-VstsLocString -Key DIFFPKG_ServiceDoesNotExist -ArgumentList @($localServiceManifest.Name, $ApplicationName, $ConnectedServiceEndpoint.Url))
                Copy-Item $localServicePkgPath $diffServicePkgPath -Recurse
                continue
            }
        
            # If the Version of the Service is not changed, don't include the service in the diff package
            if ($clusterServiceManifest.Version -eq $localServiceManifest.Version)
            {
                Write-Host (Get-VstsLocString -Key DIFFPKG_ServiceIsNotChanged -ArgumentList @($localServiceManifest.Name, $ApplicationName, $clusterServiceManifest.Version, $ConnectedServiceEndpoint.Url))
                continue
            }
            Write-Host (Get-VstsLocString -Key DIFFPKG_CreatingDiffPackageForService -ArgumentList @($localServiceManifest.Name, $clusterServiceManifest.Version, $localServiceManifest.Version))

            Copy-DiffPackage -clusterPackages $clusterServiceManifest.CodePackage -localPackages $localServiceManifest.CodePackage -localParentPkgPath $localServicePkgPath -diffParentPkgPath $diffServicePkgPath
            Copy-DiffPackage -clusterPackages $clusterServiceManifest.ConfigPackage -localPackages $localServiceManifest.ConfigPackage -localParentPkgPath $localServicePkgPath -diffParentPkgPath $diffServicePkgPath
            Copy-DiffPackage -clusterPackages $clusterServiceManifest.DataPackage -localPackages $localServiceManifest.DataPackage -localParentPkgPath $localServicePkgPath -diffParentPkgPath $diffServicePkgPath

            Write-Host (Get-VstsLocString -Key DIFFPKG_CopyingToDiffPackge -ArgumentList @($localServiceManifestPath, (Join-Path $diffServicePkgPath $serviceManifestName)))
            Copy-Item $localServiceManifestPath (Join-Path $diffServicePkgPath $serviceManifestName) -Force
        }

        Return $diffPackagePath

    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Copy-DiffPackage
{
    param (
        [array] $clusterPackages,
        [array] $localPackages,
        [string] $localParentPkgPath,
        [string] $diffParentPkgPath
    )

    $clusterPackagesByName = @{}

    foreach ($clusterPackage in $clusterPackages)
    {
        $clusterPackagesByName[$clusterPackage.Name] = $clusterPackage
    }

    foreach ($localPackage in $localPackages)
    {
        $clusterPackage = $clusterPackagesByName[$localPackage.Name]

        # If cluster package exists and the version is the same to the local package version, do not add the local package to Diff Package
        if ($clusterPackage.Version -eq $localPackage.Version)
        {
            continue
        }

        $localPkgPath = Join-Path $localParentPkgPath $localPackage.Name
        $diffPkgPath = Join-Path $diffParentPkgPath $localPackage.Name

        Write-Host (Get-VstsLocString -Key DIFFPKG_CopyingToDiffPackge -ArgumentList @($localPkgPath, $diffPkgPath))
        # Copy the package on this level to diff package which is considered to be Leaf
        Copy-Item $localPkgPath $diffPkgPath -Recurse
    }
    return
}
