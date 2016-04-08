Write-Verbose "Starting SonarQube PostBuild Step"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

. $PSScriptRoot/Common/SonarQubeHelpers/SonarQubeHelper.ps1

# During PR builds only an "issues mode" analysis is allowed. The resulting issues are posted as code review comments. 
# The feature can be toggled by the user and is OFF by default.  
if (ShouldExitOnPRBuild)
{
    Write-Host "SonarQube analysis is disabled during builds triggered by pull requests. Set a build variable named 'SQPullRequestBot' to 'true' to have the task post code analysis issues as comments in the PR. More information at http://go.microsoft.com/fwlink/?LinkID=786316"
    exit
}

. $PSScriptRoot/SonarQubePostTestImpl.ps1
. $PSScriptRoot/SonarQubeBuildBreaker.ps1
. $PSScriptRoot/PRCA/Orchestrator.ps1

InvokeMSBuildRunnerPostTest
UploadSummaryMdReport
HandleCodeAnalysisReporting
BreakBuildOnQualityGateFailure
