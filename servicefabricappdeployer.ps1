Param
(
    $ClusterConnectionString,
    $ApplicationPackagePath,
    $RemoveAllApplications,
	$ApplicationParameters
)

Write-Host $ClusterConnectionString
Write-Host $ApplicationPackagePath
Write-Host $ApplicationParameters
Write-Host "remove all applications is: $RemoveAllApplications "

function RemoveAllServiceFabricApplications
{
	$nodesList = Get-ServiceFabricNode
	foreach($currentNode in $nodesList){
		$nodeName = $currentNode.NodeName
		$applicationsList = Get-ServiceFabricDeployedApplication -NodeName $nodeName
		foreach($application in $applicationsList){
			$applicationName = $application.ApplicationName.OriginalString
			$applicationTypeName = $application.ApplicationTypeName
			#$applicationVersion = (Get-ServiceFabricApplication -ApplicationName $applicationName).ApplicationTypeVersion

			$applicationObj = Get-ServiceFabricApplication -ApplicationName $applicationName
			if($applicationObj) {
				$applicationVersion = $applicationObj.ApplicationTypeVersion
	            Write-Host -ForegroundColor red "removing applicationname: $applicationName applicationTypeName: $applicationTypeName applicationTypeVersion:$applicationVersion nodeName: $nodeName"
				Remove-ServiceFabricApplication -ApplicationName $applicationName -Force
				Unregister-ServiceFabricApplicationType -ApplicationTypeName  $applicationTypeName -ApplicationTypeVersion $applicationVersion -Force
			}
		}
	}
}

$LocalFolder = (Split-Path $MyInvocation.MyCommand.Path)

$UtilitiesModulePath = "$LocalFolder\Utilities.psm1"
Import-Module $UtilitiesModulePath

$ApplicationPackagePath = Resolve-Path $ApplicationPackagePath
$ApplicationManifestPath = "$ApplicationPackagePath\ApplicationManifest.xml"

if (!(Test-Path $ApplicationManifestPath))
{
    throw "$ApplicationManifestPath is not found. You may need to create a package by running the 'Package' command in Visual Studio for the desired build configuration (Debug or Release)."
}

$env:TEMP = 'C:\temp\'
$env:TMP = 'C:\temp\'

$packageValidationSuccess = (Test-ServiceFabricApplicationPackage $ApplicationPackagePath)
if (!$packageValidationSuccess)
{
    throw "Validation failed for package: $ApplicationPackagePath"
}

Write-Host 'Deploying application...'


try
{
    Write-Host 'Connecting to the cluster...'
    Connect-ServiceFabricCluster -ConnectionEndpoint $ClusterConnectionString
}
catch [System.Fabric.FabricObjectClosedException]
{
    Write-Warning "Service Fabric cluster may not be connected."
    throw
}

if($RemoveAllApplications -eq $true) {
    Write-Host 'Removing all applications...'
	RemoveAllServiceFabricApplications
}

# Get image store connection string
$clusterManifestText = Get-ServiceFabricClusterManifest
$imageStoreConnectionString = Get-ImageStoreConnectionString ([xml] $clusterManifestText)

$names = Get-Names -ApplicationManifestPath $ApplicationManifestPath
if (!$names)
{
    return
}

$tmpPackagePath = Copy-Temp $ApplicationPackagePath $names.ApplicationTypeName
$applicationPackagePathInImageStore = "$($names.ApplicationTypeName)_$($names.ApplicationTypeVersion)"

$applicationParameterHashTable = ConvertFrom-StringData -StringData $ApplicationParameters

Write-Host 'Copying application package...'
Copy-ServiceFabricApplicationPackage -ApplicationPackagePath $tmpPackagePath -ImageStoreConnectionString $imageStoreConnectionString -ApplicationPackagePathInImageStore $applicationPackagePathInImageStore

Write-Host 'Registering application type...'
Register-ServiceFabricApplicationType -ApplicationPathInImageStore $applicationPackagePathInImageStore

Write-Host 'Creating application...'
[void](New-ServiceFabricApplication -ApplicationName $names.ApplicationName -ApplicationTypeName $names.ApplicationTypeName -ApplicationTypeVersion $names.ApplicationTypeVersion -ApplicationParameter $applicationParameterHashTable)

Do 
{ 
	Start-Sleep -s 10
	$status = Get-ServiceFabricApplication -ApplicationName $names.ApplicationName 

	Write-Output $status

} 
While (($status.ApplicationStatus -ne "Ready") -and ($status.HealthState -ne "Ok"))
Write-Host 'Create application succeeded'
