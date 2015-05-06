param(
    [string]$solution,
    [ValidateSet("Restore", "Install")]
    [string]$restoreMode = "Restore",
    [string]$excludeVersion,
    [string]$noCache,
    [string]$nuGetArgs,
    [string]$nuGetPath
)

Write-Verbose "Entering script $MyInvocation.MyCommand.Name"
Write-Verbose "Parameter Values"
foreach($key in $PSBoundParameters.Keys)
{
    Write-Verbose ($key + ' = ' + $PSBoundParameters[$key])
}

import-module Microsoft.TeamFoundation.DistributedTask.Task.Common

if(!$solution)
{
    throw (Get-LocalizedString -Key "Solution parameter must be set")
}

$b_excludeVersion = Convert-String $excludeVersion Boolean
$b_noCache = Convert-String $noCache Boolean

# check for solution pattern
if ($solution.Contains("*") -or $solution.Contains("?"))
{
    Write-Verbose "Pattern found in solution parameter."
    Write-Verbose "Find-Files -SearchPattern $solution"
    $solutionFiles = Find-Files -SearchPattern $solution
    Write-Verbose "solutionFiles = $solutionFiles"
}
else
{
    Write-Verbose "No Pattern found in solution parameter."
    $solutionFiles = ,$solution
}

if (!$solutionFiles)
{
    throw (Get-LocalizedString -Key "No solution with search pattern '{0}' was found." -ArgumentList $solution)
}

$args = " -NonInteractive";


if($b_excludeVersion)
{
    $args = (" -ExcludeVersion " + $args);
}

if($b_noCache)
{
    $args = (" -NoCache " + $args);
}

if(!$nuGetPath)
{
    $nuGetPath = Get-ToolPath -Name 'NuGet.exe';
}

if($nuGetArgs)
{
    $args = ($args + " " + $nuGetArgs);
}


if (-not $nugetPath)
{
    throw (Get-LocalizedString -Key "Unable to locate {0}" -ArgumentList 'nuget.exe')
}

foreach($sf in $solutionFiles)
{
    if($nuGetPath)
    {
        $slnFolder = $(Get-ItemProperty -Path $sf -Name 'DirectoryName').DirectoryName

        Write-Verbose "Searching for nuget package configuration files using pattern $slnFolder\**\packages.config"
        $pkgConfig = Find-Files -SearchPattern "$slnFolder\**\packages.config"
        if ($pkgConfig)
        {
            Write-Verbose "Running nuget package restore for $slnFolder"
            Invoke-Tool -Path $nugetPath -Arguments "restore `"$sf`" $args" -WorkingFolder $slnFolder
        }
        else
        {
            Write-Verbose "No nuget package configuration files found for $sf"
        }
    }
}
