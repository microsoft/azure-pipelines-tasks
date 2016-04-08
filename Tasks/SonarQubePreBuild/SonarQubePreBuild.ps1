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
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"

. $PSScriptRoot/Common/SonarQubeHelpers/SonarQubeHelper.ps1

# During PR builds only an "issues mode" analysis is allowed. The resulting issues are posted as code review comments. 
# The feature can be toggled by the user and is OFF by default.  
if (ShouldExitOnPRBuild)
{
    Write-Host "SonarQube analysis is disabled during builds triggered by pull requests. Set a build variable named 'SQPullRequestBot' to 'true' to have the task post code analysis issues as comments in the PR. More information at http://go.microsoft.com/fwlink/?LinkID=786316"
    exit
}

. $PSScriptRoot/SonarQubePreBuildImpl.ps1

InvokePreBuildTask






