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

. ./SonarQubeHelper.ps1

$prcaEnabled = Get-TaskVariable -Context $distributedTaskContext -Name "PullRequestSonarQubeCodeAnalysisEnabled"
if ($prcaEnabled -ieq "true")
{
    if ($cmdLineArgs -and $cmdLineArgs.ToString().Contains("sonar.analysis.mode"))
    {
        throw "Error: sonar.analysis.mode seems to be set already. Please check the properties of SonarQube build tasks and try again."
    }

    Write-Verbose -Verbose "PullRequestSonarQubeCodeAnalysisEnabled is true, setting command line args for incremental mode for sonar-runner..."

    $cmdLineArgs = $cmdLineArgs + " " + "/d:sonar.analysis.mode=incremental"

    #use this variable in post-test task
    SetTaskContextVariable "SonarqubeAnalysisModeIsIncremental" "true"
}

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

$serviceEndpoint = GetEndpointData $connectedServiceName

Write-Verbose -Verbose "serverUrl = $($serviceEndpoint.Url)"
Write-Verbose -Verbose "serverUsername = $($serviceEndpoint.Authorization.Parameters.UserName)"

$currentDir = (Get-Item -Path ".\" -Verbose).FullName
$bootstrapperDir = [System.IO.Path]::Combine($currentDir, "MSBuild.SonarQube.Runner-1.0") # the MSBuild.SonarQube.Runner is version specific
$bootstrapperPath = [System.IO.Path]::Combine($bootstrapperDir, "MSBuild.SonarQube.Runner.exe")

# Set the path as context variable so that the post-test task will be able to read it and not compute it again;
# Also, if the variable is not set, the post-test task will know that the pre-build task did not execute
SetTaskContextVariable "BootstrapperPath" $bootstrapperPath

$arguments = CreateCommandLineArgs $projectKey $projectName $projectVersion $serviceEndpoint.Url $serviceEndpoint.Authorization.Parameters.UserName $serviceEndpoint.Authorization.Parameters.Password $dbUrl $dbUsername $dbPassword $cmdLineArgs $configFile


Write-Verbose -Verbose "Executing $bootstrapperPath with arguments $arguments"
Invoke-BatchScript $bootstrapperPath –Arguments $arguments







