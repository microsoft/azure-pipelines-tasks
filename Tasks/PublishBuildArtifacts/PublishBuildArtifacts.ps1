[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)]
    $CopyRoot,

    [String] [Parameter(Mandatory = $true)]
    $Contents,

    [String] [Parameter(Mandatory = $true)]
    $ArtifactName,

    [String] [Parameter(Mandatory = $true)]
    $ArtifactType,

    [String] [Parameter(Mandatory = $false)]
    $TargetPath
)

Write-Host "Entering script Publish-BuildArtifacts.ps1"
Write-Host "CopyRoot = $CopyRoot"
Write-Host "Contents = $Contents"
Write-Host "ArtifactName = $ArtifactName"
Write-Host "ArtifactType = $ArtifactType"

# Import the Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"

$buildId = Get-TaskVariable $distributedTaskContext "build.buildId"
$teamProjectId = Get-TaskVariable $distributedTaskContext "system.teamProjectId"
$stagingFolder = Get-TaskVariable $distributedTaskContext "build.artifactstagingdirectory"

# gather files into staging folder
Write-Host "Preparing artifact content in staging folder $stagingFolder..."
$artifactStagingFolder = Copy-BuildArtifact $distributedTaskContext $CopyRoot $stagingFolder $ArtifactName $Contents

# copy staging folder to artifact location
if ($ArtifactType -ieq "container")
{
    Publish-BuildArtifact $ArtifactName $artifactStagingFolder
}
elseif ($ArtifactType -ieq "filepath")
{
    if ((Test-Path $TargetPath) -eq 0)
    {
        Write-Host "Creating target path $TargetPath..."
        MD $TargetPath
    }

    Write-Host "Copying artifact content to $TargetPath..."
    Copy-Item $artifactStagingFolder $TargetPath -Recurse -Force

    Add-BuildArtifactLink $ArtifactName $ArtifactType $TargetPath
}

Write-Host "Leaving script Publish-BuildArtifacts.ps1"
