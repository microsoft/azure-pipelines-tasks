param(
    [string]$searchPattern,
    [string]$connectedServiceName,
    [string]$nuGetPath
)
Write-Verbose $packageFile "Entering script $MyInvocation.MyCommand.Name"
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
Write-Verbose -Verbose "serverApiKey = $($serviceEndpoint.Authorization.Parameters.AccessToken)"
$nugetServer = $($serviceEndpoint.Url)
$nugetServerKey = $($serviceEndpoint.Authorization.Parameters.AccessToken)

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