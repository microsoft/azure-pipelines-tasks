param(
    [string]$searchPattern,
    [string]$connectedServiceName,
    [string]$nuGetPath
)

function GetEndpointData
{
	param([string][ValidateNotNullOrEmpty()]$connectedServiceName)

	$serviceEndpoint = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName

	if (!$serviceEndpoint)
	{
		throw "A Connected Service with name '$ConnectedServiceName' could not be found.  Ensure that this Connected Service was successfully provisioned using the services tab in the Admin UI."
	}

    return $serviceEndpoint
}

Write-Verbose "Entering script $MyInvocation.MyCommand.Name"
Write-Verbose "Parameter Values"
foreach($key in $PSBoundParameters.Keys)
{
    Write-Verbose ($key + ' = ' + $PSBoundParameters[$key])
}

Write-Verbose "Importing modules"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
    

#Setup Nuget
Write-Verbose "Creating Nuget Arguments"

$serviceEndpoint = GetEndpointData $connectedServiceName

Write-Verbose -Verbose "serverUrl = $($serviceEndpoint.Url)"
Write-Verbose -Verbose "serverApiKey = $($serviceEndpoint.Authorization.Parameters.Password)"
$nugetServer = $($serviceEndpoint.Url)
$nugetServerKey = $($serviceEndpoint.Authorization.Parameters.Password)

Write-Verbose "Checking server url set"
if (!$nugetServer)
{
    throw "Server must be set"
}

Write-Verbose "Checking server key set"
if (!$nugetServerKey)
{
    throw "Server Key must be set"
}

Write-Verbose "Check/Set nuget path"
if(!$nuGetPath)
{
    $nuGetPath = Get-ToolPath -Name 'NuGet.exe';
}

if (-not $nuGetPath)
{
    throw (Get-LocalizedString -Key "Unable to locate {0}" -ArgumentList 'nuget.exe')
}

Write-Verbose "Find-Files -SearchPattern $searchPattern"
$packagesToPush = Find-Files -SearchPattern $searchPattern

foreach ($packageFile in $packagesToPush)
{
    Write-Verbose "Invoking nuget with $argsUpload on $packageFile"    
    $argsUpload = "push $packageFile -s $nugetServer $nugetServerKey"
    Invoke-Tool -Path $nugetPath -Arguments "$argsUpload" 
}