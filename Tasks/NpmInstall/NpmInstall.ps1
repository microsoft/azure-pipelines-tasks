param(
    [string]$arguments,
    [string]$cwd
)

Write-Verbose "Entering script $MyInvocation.MyCommand.Name"
Write-Verbose "Parameter Values"
foreach($key in $PSBoundParameters.Keys)
{
    Write-Verbose ($key + ' = ' + $PSBoundParameters[$key])
}

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
    
$npm = Get-Command -Name npm -ErrorAction Ignore

if(!$npm)
{
    throw (Get-LocalizedString -Key "Unable to locate {0}" -ArgumentList 'npm')
}

$args = " install "

if($arguments)
{
    $argsSplit = $arguments.Split(' ')
    $argsSplit | ForEach-Object { $args = $args + " " + $_ }
}

Invoke-Tool -Path $npm -Arguments $args
