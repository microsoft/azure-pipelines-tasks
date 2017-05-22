param (
    [string]$sourceFilepath,
    [string]$targetFilepath
)

Write-Verbose "Entering script CopyFile.ps1"
Write-Verbose "sourceFilepath = $sourceFilepath"
Write-Verbose "targetFilepath = $targetFilepath"

Write-Output "Copying: [$sourceFilepath] => [$targetFilepath]."
Copy-Item -Force $sourceFilepath -destination $targetFilepath
