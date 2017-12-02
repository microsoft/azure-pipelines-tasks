# For more information on the VSTS Task SDK:
# https://github.com/Microsoft/vsts-task-lib

function Create-DiffPackage
{
	[CmdletBinding()]
	param(
		[parameter(Mandatory=$true)][String] $ApplicationName,
		[parameter(Mandatory=$true)] $ConnectedServiceEndpoint,
		[parameter(Mandatory=$true)][Hashtable] $ClusterConnectionParameters
	)

	Trace-VstsEnteringInvocation $MyInvocation
	try {
		Write-Host "Creating Diff Package"
		# Import the localized strings.
		Import-VstsLocStrings "$PSScriptRoot\task.json"

		# Load utility functions
		. "$PSScriptRoot\utilities.ps1"
		Import-Module $PSScriptRoot\ps_modules\ServiceFabricHelpers
		Import-Module $PSScriptRoot\ps_modules\PowershellHelpers

		# Connect to cluster
		#Connect-ServiceFabricClusterFromServiceEndpoint -ClusterConnectionParameters $ClusterConnectionParameters -ConnectedServiceEndpoint $ConnectedServiceEndpoint

		. "$PSScriptRoot\ServiceFabricSDK\ServiceFabricSDK.ps1"

		$appManifestName = "ApplicationManifest.xml"
		$localAppManifestPath = Join-Path $applicationPackagePath $appManifestName
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

		$clusterAppTypeVersion = $app.ApplicationTypeVersion

		# If the ApplicationTypeVersion of the Application is not upgraded, skip upgrading the Application
		if ($clusterAppTypeVersion -eq $localAppTypeVersion)
		{
			Write-Host (Get-VstsLocString -Key DIFFPKG_ApplicationIsNotChanged -ArgumentList @($ApplicationName, $clusterAppTypeVersion, $ConnectedServiceEndpoint.Url))
			Return
		}

		# This command gets the service types, packs the service manifest names into an array
		$serviceTypes = Get-ServiceFabricServiceType -ApplicationTypeName $applicationTypeName -ApplicationTypeVersion $clusterAppTypeVersion
		# Get the service manifest names from the cluster
		$clusterServiceManifestNames = $serviceTypes.ServiceManifestName

		# If $clusterServiceManifestNames is null, it means no services are running in the cluster. Diff Package is equal to Full Package. Use Full Package to do deployment
		if (!$clusterServiceManifestNames)
		{
			Write-Host (Get-VstsLocString -Key DIFFPKG_NoServicesRunning -ArgumentList @($ApplicationName, $ConnectedServiceEndpoint.Url))
			Return
		}

		Write-Host (Get-VstsLocString -Key DIFFPKG_CopyingToDiffPackge -ArgumentList @($localAppManifestPath, (Join-Path $diffPackagePath $appManifestName)))
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
				Write-Host (Get-VstsLocString -Key DIFFPKG_ServiceDoesNotExist -ArgumentList @($localServiceManifest.Name, $ApplicationName, $ConnectedServiceEndpoint.Url))
				Copy-Item $localServicePkgPath $diffServicePkgPath -Recurse
				continue
			}
		
			# If the Version of the Service is not upgraded, skip upgrading the Service
			if ($clusterServiceManifest.Version -eq $localServiceManifest.Version)
			{
				Write-Host (Get-VstsLocString -Key DIFFPKG_ServiceIsNotChanged -ArgumentList @($localServiceManifest.Name, $ApplicationName, $clusterServiceManifest.Version, $ConnectedServiceEndpoint.Url))
				continue
			}

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
