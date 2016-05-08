param(
    [string]$solution,
    [string]$nugetConfigPath,
    [ValidateSet("restore", "install")]
    [string]$restoreMode,
    [string]$excludeVersion, # Support for excludeVersion has been deprecated.
    [string]$noCache,
    [string]$nuGetRestoreArgs,
    [string]$nuGetPath
)

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

. $PSScriptRoot\VsoNuGetHelper.ps1

$MyCommandName = $MyInvocation.MyCommand.Name
Write-Verbose "Entering script $MyCommandName"
Write-Verbose "Parameter Values"
foreach($key in $PSBoundParameters.Keys)
{
    Write-Verbose ($key + ' = ' + $PSBoundParameters[$key])
}

if(!$solution)
{
    throw (Get-LocalizedString -Key "Solution parameter must be set")
}

$b_excludeVersion = Convert-String $excludeVersion Boolean
$b_noCache = Convert-String $noCache Boolean

# Warn if deprecated parameters were supplied.
if ($excludeVersion -and "$excludeVersion".ToUpperInvariant() -ne 'FALSE')
{
    Write-Warning (Get-LocalizedString -Key 'The Exclude Version parameter has been deprecated. Ignoring the value.')
}

# check for solution pattern
if ($solution.Contains("*") -or $solution.Contains("?"))
{
    Write-Verbose "Pattern found in solution parameter."
    if ($env:SYSTEM_DEFAULTWORKINGDIRECTORY)
    {
        Write-Verbose "Find-Files -SearchPattern $solution -RootFolder $env:SYSTEM_DEFAULTWORKINGDIRECTORY"
        $solutionFiles = Find-Files -SearchPattern $solution -RootFolder $env:SYSTEM_DEFAULTWORKINGDIRECTORY
    }
    else
    {
        Write-Verbose "Find-Files -SearchPattern $solution"
        $solutionFiles = Find-Files -SearchPattern $solution
    }
    Write-Verbose "solutionFiles = $solutionFiles"
}
else
{
    Write-Verbose "No Pattern found in solution parameter."
    $solutionFiles = ,$solution
}

if (!$solutionFiles)
{
    throw (Get-LocalizedString -Key "No solution was found using search pattern '{0}'." -ArgumentList $solution)
}

$args = " -NonInteractive";
if($b_noCache)
{
    $args = (" -NoCache " + $args);
}

$useBuiltinNuGetExe = !$nuGetPath

if($useBuiltinNuGetExe)
{
    $nuGetPath = Get-ToolPath -Name 'NuGet.exe';
}

if (-not $nugetPath)
{
    throw (Get-LocalizedString -Key "Unable to locate {0}" -ArgumentList 'nuget.exe')
}

if($nuGetRestoreArgs)
{
    if($nuGetRestoreArgs.ToLowerInvariant().Contains("-configfile"))
    {
        Write-Warning (Get-LocalizedString -Key "ConfigFile was passed as a command line parameter, which may be ignored in certain parts of this task. Please specify the config file in the build definition instead.")
    }

    $args = ($args + " " + $nuGetRestoreArgs);
}

if($nugetConfigPath -and ($nugetConfigPath -ne $env:System_DefaultWorkingDirectory))
{
    $args = "$args -configfile `"$tempNuGetConfigPath`""

    $endpoint = Get-ServiceEndpoint -Context $distributedTaskContext -Name SystemVssConnection
    if($endpoint.Authorization.Scheme -eq 'OAuth')
    {
        Write-Verbose "Getting credentials for $($endpoint)"
        $accessToken = $endpoint.Authorization.Parameters['AccessToken']
    }
    else
    {
        Write-Warning (Get-LocalizedString -Key "Could not determine credentials to use for NuGet")
        $accessToken = ""
    }

    $nugetConfig = [xml](Get-Content $nugetConfigPath)

    SetCredentialsNuGetConfigAndSaveTemp $nugetConfig $accessToken
}

$initialNuGetExtensionsPath = $env:NUGET_EXTENSIONS_PATH
try
{
    if ($env:NUGET_EXTENSIONS_PATH)
    {
        if($useBuiltinNuGetExe)
        {
            # NuGet.exe extensions only work with a single specific version of nuget.exe. This causes problems
            # whenever we update nuget.exe on the agent.
            $env:NUGET_EXTENSIONS_PATH = $null
            Write-Warning (Get-LocalizedString -Key "The NUGET_EXTENSIONS_PATH environment variable is set, but nuget.exe extensions are not supported when using the built-in NuGet implementation.")   
        }
        else
        {
            Write-Host (Get-LocalizedString -Key "Detected NuGet extensions loader path. Environment variable NUGET_EXTENSIONS_PATH is set to: {0}" -ArgumentList $env:NUGET_EXTENSIONS_PATH)
        }
    }

    foreach($sf in $solutionFiles)
    {
        if($nuGetPath)
        {
            $slnFolder = $(Get-ItemProperty -Path $sf -Name 'DirectoryName').DirectoryName
            Write-Verbose "Running nuget package $restoreMode for $slnFolder"
            Invoke-Tool -Path $nugetPath -Arguments "$restoreMode `"$sf`" $args" -WorkingFolder $slnFolder
        }
    }
}
finally
{
    $env:NUGET_EXTENSIONS_PATH = $initialNuGetExtensionsPath
}