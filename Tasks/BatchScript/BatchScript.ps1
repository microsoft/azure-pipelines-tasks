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

$allowModifyEnvironment = Convert-String $modifyEnvironment Boolean
Write-Verbose "modifyEnvironment (converted) = $allowModifyEnvironment"

# Check for file existence
if ([System.IO.File]::Exists($filename))
{
    $currentLocation = Get-Location
    Write-Verbose "Current working folder: $currentLocation"
    if ($workingFolder)
    {
        Write-Verbose "Changing the current working folder to: $workingFolder"
        Set-Location -Path $workingFolder
        $currentLocation = Get-Location
        Write-Verbose "New working folder: $currentLocation"
    }

    if ($allowModifyEnvironment)
    {
        Write-Verbose "Invoking script $filename with AllowScriptToChangeEnvironment flag set"
        if ($arguments)
        {
            Invoke-BatchScript $filename -AllowScriptToChangeEnvironment -Arguments $arguments
        }
        else
        {
            Invoke-BatchScript $filename -AllowScriptToChangeEnvironment 
        }
    }
    else
    {
        Write-Verbose "Invoking script $filename without AllowScriptToChangeEnvironment flag"
        if ($arguments)
        {
            Invoke-BatchScript $filename -Arguments $arguments
        }
        else
        {
            Invoke-BatchScript $filename
        }
    }
}
else
{
    Write-Error (Get-LocalizedString -Key "Unable to find script {0}" -ArgumentList $filename)
}

Write-Verbose "Leaving script CmdScript.ps1"
