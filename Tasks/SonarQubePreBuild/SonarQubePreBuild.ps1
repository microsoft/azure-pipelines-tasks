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
    [string]$configFile,
    [string]$breakBuild
)

Write-Verbose "Starting SonarQube Pre-Build Setup Step"

Write-Verbose "connectedServiceName = $connectedServiceName"
Write-Verbose "projectKey = $projectKey"
Write-Verbose "projectName = $projectName"
Write-Verbose "cmdLineArgs = $cmdLineArgs"
Write-Verbose "configFile = $configFile"
Write-Verbose "dbConnectionString = $dbUrl"
Write-Verbose "breakBuild = $breakBuild"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
. ./SonarQubeHelper.ps1
. ./SonarQubePreBuildImpl.ps1

$serviceEndpoint = GetEndpointData $connectedServiceName
Write-Verbose "serverUrl = $($serviceEndpoint.Url)"

$currentDir = (Get-Item -Path ".\" -Verbose).FullName
$bootstrapperDir = [System.IO.Path]::Combine($currentDir, "MSBuild.SonarQube.Runner-1.1") # the MSBuild.SonarQube.Runner is version specific
$bootstrapperPath = [System.IO.Path]::Combine($bootstrapperDir, "MSBuild.SonarQube.Runner.exe")

StoreParametersInTaskContext $serviceEndpoint.Url $bootstrapperPath "$($serviceEndpoint.Url)/dashboard/index?id=$($projectKey)" $breakBuild
StoreSensitiveParametersInTaskContext $serviceEndpoint.Authorization.Parameters.UserName $serviceEndpoint.Authorization.Parameters.Password $dbUsername $dbPassword

$cmdLineArgs = UpdateArgsForPullRequestAnalysis $cmdLineArgs $serviceEndpoint
Write-Verbose -Verbose $cmdLineArgs

$arguments = CreateCommandLineArgs $projectKey $projectName $projectVersion $serviceEndpoint.Url $serviceEndpoint.Authorization.Parameters.UserName $serviceEndpoint.Authorization.Parameters.Password $dbUrl $dbUsername $dbPassword $cmdLineArgs $configFile

Invoke-BatchScript $bootstrapperPath –Arguments $arguments






