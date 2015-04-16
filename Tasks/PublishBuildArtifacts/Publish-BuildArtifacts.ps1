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
Write-Host "Contents= $Contents"
Write-Host "ArtifactName= $ArtifactName"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

$agentRoot = Get-Variable $distributedTaskContext "agent.buildDirectory"
$buildId = Get-Variable $distributedTaskContext "build.buildId"
$teamProjectId = Get-Variable $distributedTaskContext "system.teamProjectId"
$stagingFolder = Get-Variable $distributedTaskContext "build.stagingdirectory"

# gather files into staging folder
Write-Host "Preparing artifact content in staging folder..."
$artifactStagingFolder = Prepare-BuildArtifact $distributedTaskContext $agentRoot $stagingFolder $ArtifactName $Contents

# copy staging folder to artifact location
$endpointService = $distributedTaskContext.GetService([Microsoft.TeamFoundation.DistributedTask.Agent.Interfaces.IEndpointService])
$endpoint = $endpointService.GetEndpoint("Job")

if ($ArtifactType -ieq "container")
{
    Write-Host "Uploading artifact content to the build container..."
    Upload-StagingFolder $distributedTaskContext $endpoint $teamProjectId $ArtifactName $artifactStagingFolder
    $buildContainerId = Get-Variable $distributedTaskContext "build.containerId"
    $artifactData = "#/$buildContainerId/$ArtifactName"
}
elseif ($ArtifactType -ieq "localpath")
{
    #$artifactData = 
}

# Create build artifact
# BackCompat issue with cmdlet (new required parameter)
# Check to see which version of the cmdlet we are using
Write-Host "Associating the artifact $artifactData with the build..."
$cmdDefinition = Get-Command Add-BuildArtifact
if ($cmdDefinition.Definition.Contains("-Type"))
{
    # New version of the cmdlet; project id and artifact type required
    Add-BuildArtifact -BuildId $buildId -ProjectId $teamProjectId -Endpoint $endpoint -Name $ArtifactName -Type $ArtifactType -Data $artifactData
}
elseif ($cmdDefinition.Definition.Contains("-ProjectId"))
{
    # Less-new version of the cmdlet; project id required
    Add-BuildArtifact -BuildId $buildId -ProjectId $teamProjectId -Endpoint $endpoint -Name $ArtifactName -Data $artifactData
}
else
{
    # Old version of the cmdlet; don't pass project id
    Add-BuildArtifact -BuildId $buildId -Endpoint $endpoint -Name $ArtifactName -Data $artifactData
}

Write-Host "Leaving script Publish-BuildArtifacts.ps1"
