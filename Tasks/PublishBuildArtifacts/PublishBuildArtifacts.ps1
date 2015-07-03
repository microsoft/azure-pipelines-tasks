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

Write-Verbose "Entering script Publish-BuildArtifacts.ps1"
Write-Verbose "CopyRoot = $CopyRoot"
Write-Verbose "Contents = $Contents"
Write-Verbose "ArtifactName = $ArtifactName"
Write-Verbose "ArtifactType = $ArtifactType"
Write-Verbose "TargetPath = $TargetPath"

# Import the Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"

$buildId = Get-TaskVariable $distributedTaskContext "build.buildId"
$teamProjectId = Get-TaskVariable $distributedTaskContext "system.teamProjectId"
$stagingFolder = Get-TaskVariable $distributedTaskContext "build.artifactstagingdirectory"

# gather files into staging folder
Write-Host (Get-LocalizedString -Key "Preparing artifact content in staging folder {0}..." -ArgumentList $stagingFolder)
$artifactStagingFolder = Copy-BuildArtifact $distributedTaskContext $CopyRoot $stagingFolder $ArtifactName $Contents

# copy staging folder to artifact location
if ($ArtifactType -ieq "container")
{
    Publish-BuildArtifact $ArtifactName $artifactStagingFolder
}
elseif ($ArtifactType -ieq "filepath")
{
    if ("$TargetPath".StartsWith('//'))
    {
        Write-Warning (Get-LocalizedString -Key 'The share path cannot start with ''//''. Use ''\\'' instead. Invalid share path: {0}' -ArgumentList $TargetPath)
    }

    if ((Test-Path $TargetPath) -eq 0)
    {
        Write-Host (Get-LocalizedString -Key 'Creating target path {0}...' -ArgumentList $TargetPath)
        MD $TargetPath
    }

    Write-Host (Get-LocalizedString -Key 'Copying artifact content to {0}...' -ArgumentList $TargetPath)
    Copy-Item $artifactStagingFolder $TargetPath -Recurse -Force

    Add-BuildArtifactLink $ArtifactName $ArtifactType $TargetPath
}

Write-Verbose "Leaving script Publish-BuildArtifacts.ps1"
