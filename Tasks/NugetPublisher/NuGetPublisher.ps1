param(
    [string]$searchPattern,
    [string]$nuGetPath
)
$packageFile "Entering script $MyInvocation.MyCommand.Name"
Write-Verbose "Parameter Values"
foreach($key in $PSBoundParameters.Keys)
{
    Write-Verbose ($key + ' = ' + $PSBoundParameters[$key])
}

Write-Verbose "Importing modules"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
    

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

#Setup Nuget
Write-Verbose "Creating Nuget Arguments"

$nugetServer = 
$nugetServerKey = 

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