[CmdletBinding(DefaultParameterSetName = 'None')]
param(
	[string][Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()] $connectedServiceName,
    [string][Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()] $projectKey,
    [string][Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()] $projectName,
    [string][Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()] $projectVersion,	
	[string]$dbUrl,
	[string]$dbUsername,
	[string]$dbPassword,
    [string]$cmdLineArgs,
    [string]$configFile
)

Write-Verbose "Starting SonarQube Pre-Build Setup Step"

Write-Verbose "connectedServiceName = $connectedServiceName"
Write-Verbose "projectKey = $projectKey"
Write-Verbose "projectName = $projectName"
Write-Verbose "cmdLineArgs = $cmdLineArgs"
Write-Verbose "configFile = $configFile"
Write-Verbose "dbConnectionString = $dbUrl"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
. ./SonarQubePreBuildImpl.ps1


$serviceEndpoint = GetEndpointData $connectedServiceName
Write-Verbose "serverUrl = $($serviceEndpoint.Url)"

$cmdLineArgs = UpdateArgsForPullRequestAnalysis $cmdLineArgs $serviceEndpoint
Write-Verbose -Verbose $cmdLineArgs

$currentDir = (Get-Item -Path ".\" -Verbose).FullName
$bootstrapperDir = [System.IO.Path]::Combine($currentDir, "MSBuild.SonarQube.Runner-1.1") # the MSBuild.SonarQube.Runner is version specific
$bootstrapperPath = [System.IO.Path]::Combine($bootstrapperDir, "MSBuild.SonarQube.Runner.exe")

# Set the path as context variable so that the post-test task will be able to read it and not compute it again;
# Also, if the variable is not set, the post-test task will know that the pre-build task did not execute
SetTaskContextVariable "MsBuild.SonarQube.BootstrapperPath" $bootstrapperPath
# Expose MsBuild.SonarQube.ProjectUri, if any of the following tasks needs it
SetTaskContextVariable "MsBuild.SonarQube.ProjectUri" "$($serviceEndpoint.Url)/dashboard/index?id=$($projectKey)"

StoreSensitiveParametersInTaskContext $serviceEndpoint.Authorization.Parameters.UserName $serviceEndpoint.Authorization.Parameters.Password $dbUsername $dbPassword
$arguments = CreateCommandLineArgs $projectKey $projectName $projectVersion $serviceEndpoint.Url $serviceEndpoint.Authorization.Parameters.UserName $serviceEndpoint.Authorization.Parameters.Password $dbUrl $dbUsername $dbPassword $cmdLineArgs $configFile

Invoke-BatchScript $bootstrapperPath –Arguments $arguments







