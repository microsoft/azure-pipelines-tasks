param(
    [string]$searchPattern,
    [string]$connectedServiceName,
    [string]$nuGetAdditionalArgs,
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
Write-Host "Creating Nuget Arguments"

$serviceEndpoint = GetEndpointData $connectedServiceName

Write-Verbose "serverUrl = $($serviceEndpoint.Url)"
$nugetServer = $($serviceEndpoint.Url)

Write-Verbose "serverApiKey = $($serviceEndpoint.Authorization.Parameters.Password)"
$nugetServerKey = $($serviceEndpoint.Authorization.Parameters.Password)

Write-Host "Checking server url set"
if (!$nugetServer)
{
    throw "Server must be set"
}

Write-Host "Checking server key set"
if (!$nugetServerKey)
{
    throw "Server Key must be set, set the password on the generic service"
}

Write-Host "Check/Set nuget path"
if(!$nuGetPath)
{
    $nuGetPath = Get-ToolPath -Name 'NuGet.exe';
}

if (-not $nuGetPath)
{
    throw (Get-LocalizedString -Key "Unable to locate {0}" -ArgumentList 'nuget.exe')
}

# check for solution pattern
if ($searchPattern.Contains("*") -or $searchPattern.Contains("?"))
{
    Write-Host "Pattern found in solution parameter."
    Write-Host "Find-Files -SearchPattern $searchPattern"
    $packagesToPush = Find-Files -SearchPattern $searchPattern
}
else
{
    Write-Host "No Pattern found in solution parameter."
    $packagesToPush = ,$searchPattern
}
 
$foundCount = $packagesToPush.Count 
Write-Host "Found files: $foundCount"
foreach ($packageFile in $packagesToPush)
{
    Write-Host "File: $packagesToPush"
}

foreach ($packageFile in $packagesToPush)
{
    $argsUpload = "push $packageFile -s $nugetServer $nugetServerKey"
    if($nuGetAdditionalArgs)
    {
        $argsUpload = ($argsUpload + " " + $nuGetAdditionalArgs);
    } 
    Write-Host "Invoking nuget with $argsUpload on $packageFile"  
    Invoke-Tool -Path $nugetPath -Arguments "$argsUpload" 
}