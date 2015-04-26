[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
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
Write-Host "Contents = $Contents"
Write-Host "ArtifactName = $ArtifactName"
Write-Host "ArtifactType = $ArtifactType"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

$agentRoot = Get-Variable $distributedTaskContext "agent.buildDirectory"
$buildId = Get-Variable $distributedTaskContext "build.buildId"
$teamProjectId = Get-Variable $distributedTaskContext "system.teamProjectId"
$stagingFolder = Get-Variable $distributedTaskContext "build.artifactstagingdirectory"

# gather files into staging folder
Write-Host "Preparing artifact content in staging folder $stagingFolder..."
$artifactStagingFolder = Prepare-BuildArtifact $distributedTaskContext $agentRoot $stagingFolder $ArtifactName $Contents

# copy staging folder to artifact location
if ($ArtifactType -ieq "container")
{
    Write-Host "##vso[artifact.upload containerfolder=$ArtifactName;localpath=$artifactStagingFolder;artifactname=$ArtifactName;]"
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

    Write-Host "##vso[artifact.associate artifactname=$ArtifactName;artifactlocation=$TargetPath;]"
}

Write-Host "Leaving script Publish-BuildArtifacts.ps1"
