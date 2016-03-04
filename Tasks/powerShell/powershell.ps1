param (
[string] $type,
[string] $scriptName,
[string] $arguments,
[string] $workingFolder,
[string] $script
)

Write-Verbose 'Entering powershell.ps1'
Write-Verbose 'Current Working Directory is $cwd'
Write-Host "Here I am "
Write-Host "Type is" $type
Write-Host "ScriptName is" $scriptName
Write-Host "args are" $arguments
Write-Host "Working folder is" $workingFolder
Write-Host "Script is " $script

if($workingFolder)
{
    if(!(Test-Path $workingFolder -PathType Container))
    {
        throw ("$workingFolder does not exist");
    }
    Write-Verbose "Setting working directory to $workingFolder"
    Set-Location $workingFolder
}

if($type -eq "InlineScript"){
    Invoke-Expression $script
}else{
    # Default is FilePath
    Invoke-Expression "& `"$scriptName`" $arguments"
}
