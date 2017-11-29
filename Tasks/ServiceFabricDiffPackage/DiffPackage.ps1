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
    Import-Module $PSScriptRoot\ps_modules\PowershellHelpers

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

    $applicationName = Get-ApplicationNameFromApplicationParameterFile $applicationParameterFile
    $app = Get-ServiceFabricApplication -ApplicationName $applicationName

	$diffPackagePath = Join-Path (Get-VstsInput -Name diffPackagePath -Require) "DiffPackage"
	if (Test-Path -PathType Container -Path $diffPackagePath)
	{
		Remove-Item -Path $diffPackagePath -Recurse -Force
	}
	New-Item -ItemType Directory -Path $diffPackagePath -Force

	$appManifestName = "ApplicationManifest.xml"
    $localAppManifestPath = Join-Path $applicationPackagePath $appManifestName
    $localAppManifestXml = [XML](Get-Content $localAppManifestPath)
	$applicationTypeName = $localAppManifestXml.ApplicationManifest.ApplicationTypeName
	$localAppTypeVersion = $localAppManifestXml.ApplicationManifest.ApplicationTypeVersion

	$clusterAppTypeVersion = $app.ApplicationTypeVersion
	
	# If $clusterAppTypeVersion is null, it means not able to connect to the cluster or application does not exist in the cluster. Abort the Diff Package operation
	if (!$clusterAppTypeVersion)
	{
		Return
	}

	# Even if ($clusterAppTypeVersion -eq $localAppTypeVersion), still need to dig down to children level to try to copy diff package
	# E.g. SodaManagement: Not increasing version but do add something to the application/service

	# This command gets the service types, packs the service manifest names into an array
    $serviceTypes = Get-ServiceFabricServiceType -ApplicationTypeName $applicationTypeName -ApplicationTypeVersion $clusterAppTypeVersion
	# Get the service manifest names from the cluster
	$clusterServiceManifestNames = $serviceTypes.ServiceManifestName

	# If $clusterServiceManifestNames is null, it means no services are running in the cluster. Diff Package is equal to Full Package
	if (!$clusterServiceManifestNames)
	{
		Return
	}

	Copy-Item $localAppManifestPath (Join-Path $diffPackagePath $appManifestName) -Force

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
		$localServicePkgPath = Join-Path $applicationPackagePath $serviceManifestImport.ServiceManifestRef.ServiceManifestName
        $localServiceManifestPath = [System.IO.Path]::Combine($localServicePkgPath, $serviceManifestName)
        $localServiceManifest = ([XML](Get-Content $localServiceManifestPath)).ServiceManifest
		$diffServicePkgPath = [System.IO.Path]::Combine($diffPackagePath, $localServiceManifest.Name)

		$clusterServiceManifest = $clusterServiceManifestByName[$localServiceManifest.Name].ServiceManifest

		# If there's no matching manifest from the cluster it means this is a newly added service that doesn't exist yet on the cluster. 
        if (!$clusterServiceManifest)
        {
			# Copy this service and all the children
			Copy-Item $localServicePkgPath $diffServicePkgPath -Recurse
            continue
        }
		
		# Even if ($clusterServiceManifest.Version -eq $localAppManifestXml.Version), still need to dig down to children level to try to copy diff package
		# E.g. SodaManagement: Not increasing version but do add something to the application/service

		$hasDiffPkg = $False
		$hasDiffPkg = (Copy-DiffPackage -clusterPackages $clusterServiceManifest.CodePackage -localPackages $localServiceManifest.CodePackage -localParentPkgPath $localServicePkgPath -diffParentPkgPath $diffServicePkgPath) -or $hasDiffPkg
		$hasDiffPkg = (Copy-DiffPackage -clusterPackages $clusterServiceManifest.ConfigPackage -localPackages $localServiceManifest.ConfigPackage -localParentPkgPath $localServicePkgPath -diffParentPkgPath $diffServicePkgPath) -or $hasDiffPkg
		$hasDiffPkg = (Copy-DiffPackage -clusterPackages $clusterServiceManifest.DataPackage -localPackages $localServiceManifest.DataPackage -localParentPkgPath $localServicePkgPath -diffParentPkgPath $diffServicePkgPath) -or $hasDiffPkg
			
		if ($hasDiffPkg)
		{
			Copy-Item $localServiceManifestPath (Join-Path $diffServicePkgPath $serviceManifestName) -Force
		}
	}

} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}
