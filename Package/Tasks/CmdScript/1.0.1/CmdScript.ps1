param(
    [string]$filename, 
    [string]$arguments, 
    [string]$workingFolder,
    [string]$modifyEnvironment
)

Write-Verbose "Entering script CmdScript.ps1"
Write-Verbose "filename = $filename"
Write-Verbose "arguments = $arguments"
Write-Verbose "workingFolder = $workingFolder"
Write-Verbose "modifyEnvironment = $modifyEnvironment"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

$modifyEnvironment = Convert-String $modifyEnvironment Boolean
Write-Verbose "modifyEnvironment (converted) = $modifyEnvironment"

# Check for file existence
if ([System.IO.File]::Exists($filename))
{
    if ($modifyEnvironment)
    {
        Write-Verbose "Invoking script $filename with AllowScriptToChangeEnvironment flag set"
        Invoke-BatchScript $filename -AllowScriptToChangeEnvironment 
    }
    else
    {
        Write-Verbose "Invoking script $filename without AllowScriptToChangeEnvironment flag"
        Invoke-BatchScript $filename
    }
}
else
{
    Write-Error "Unable to find script $filename"
}

Write-Verbose "Leaving script CmdScript.ps1"
