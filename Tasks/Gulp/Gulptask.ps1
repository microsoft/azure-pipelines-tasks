[cmdletbinding()]
param(
    [string]$gulpFile,
    [string]$targets,
    [string]$arguments,
    [string]$cwd,
    [string]$gulpjs,
    [string]$OmitDotSource,
    [Parameter(ValueFromRemainingArguments = $true)]
    [object[]]$RemainingArguments)

$OFS = " "
Write-Verbose "RemainingArguments = $RemainingArguments"

# Import the Task.Common and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

if (!$OmitDotSource) {
    . $PSScriptRoot\Helpers.ps1
}

$gulp = Get-GulpCommand
$arguments = Format-ArgumentsParameter -GulpFile $gulpFile -Targets $targets -Arguments $arguments
$cwd = Get-WorkingDirectoryParameter -Cwd $cwd
Write-Verbose "Running Gulp: $($gulp.Path)"
Invoke-Tool -Path $gulp.Path -Arguments $arguments -WorkingFolder $cwd