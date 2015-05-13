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

# Import the Task.Common and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"

$allowModifyEnvironment = Convert-String $modifyEnvironment Boolean
Write-Verbose "modifyEnvironment (converted) = $allowModifyEnvironment"

# Check for file existence
if ([System.IO.File]::Exists($filename))
{    
    if ($workingFolder)
    {
        $currentLocation = $workingFolder
        Write-Verbose "Current working folder: $currentLocation"
    }
    else
    {
        $currentLocation = Get-Location
        Write-Verbose "Current working folder: $currentLocation"
    }

    if ($allowModifyEnvironment)
    {
        Write-Verbose "Invoking script $filename with AllowScriptToChangeEnvironment flag set"
        if ($arguments)
        {
            Invoke-BatchScript $filename -AllowScriptToChangeEnvironment -Arguments $arguments -WorkingFolder $workingFolder
        }
        else
        {
            Invoke-BatchScript $filename -AllowScriptToChangeEnvironment -WorkingFolder $workingFolder
        }
    }
    else
    {
        Write-Verbose "Invoking script $filename without AllowScriptToChangeEnvironment flag"
        if ($arguments)
        {
            Invoke-BatchScript $filename -Arguments $arguments -WorkingFolder $workingFolder
        }
        else
        {
            Invoke-BatchScript $filename -WorkingFolder $workingFolder
        }
    }
}
else
{
    Write-Error (Get-LocalizedString -Key "Unable to find script {0}" -ArgumentList $filename)
}

Write-Verbose "Leaving script CmdScript.ps1"
