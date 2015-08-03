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

Write-Verbose -Verbose "connectedServiceName = $connectedServiceName"
Write-Verbose -Verbose "projectKey = $projectKey"
Write-Verbose -Verbose "projectName = $projectName"
Write-Verbose -Verbose "cmdLineArgs = $cmdLineArgs"
Write-Verbose -Verbose "configFile = $configFile"
Write-Verbose -Verbose "dbConnectionString = $dbUrl"
Write-Verbose -Verbose "dbUsername = $dbUsername"


import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

. ./SonarQubeHelper.ps1

$serviceEndpoint = GetEndpointData $connectedServiceName

Write-Verbose -Verbose "serverUrl = $($serviceEndpoint.Url)"
Write-Verbose -Verbose "serverUsername = $($serviceEndpoint.Authorization.Parameters.UserName)"

$currentDir = (Get-Item -Path ".\" -Verbose).FullName
$bootstrapperDir = [System.IO.Path]::Combine($currentDir, "MSBuild.SonarQube.Runner-1.0") # the MSBuild.SonarQube.Runner is version specific
$bootstrapperPath = [System.IO.Path]::Combine($bootstrapperDir, "MSBuild.SonarQube.Runner.exe")

# Set the path as context variable so that the post-test task will be able to read it and not compute it again;
# Also, if the variable is not set, the post-test task will know that the pre-build task did not execute
SetTaskContextVaraible "BootstrapperPath" $bootstrapperPath

$arguments = CreateCommandLineArgs $projectKey $projectName $projectVersion $serviceEndpoint.Url $serviceEndpoint.Authorization.Parameters.UserName $serviceEndpoint.Authorization.Parameters.Password $dbUrl $dbUsername $dbPassword $cmdLineArgs $configFile


Write-Verbose -Verbose "Executing $bootstrapperPath with arguments $arguments"
Invoke-BatchScript $bootstrapperPath –Arguments $arguments







