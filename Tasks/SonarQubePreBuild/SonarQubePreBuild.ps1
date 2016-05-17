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
    [string]$includeFullReport,
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
Write-Verbose "includeFullReport = $includeFullReport"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"

. $PSScriptRoot/Common/SonarQubeHelpers/SonarQubeHelper.ps1

# During PR builds only an "issues mode" analysis is allowed. The resulting issues are posted as code review comments. 
# The feature can be toggled by the user and is OFF by default.  
ExitOnPRBuild

. $PSScriptRoot/SonarQubePreBuildImpl.ps1

InvokePreBuildTask






