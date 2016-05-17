Write-Verbose "Starting SonarQube PostBuild Step"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

. $PSScriptRoot/Common/SonarQubeHelpers/SonarQubeHelper.ps1

# During PR builds only an "issues mode" analysis is allowed. The resulting issues are posted as code review comments. 
# The feature can be toggled by the user and is OFF by default.  
ExitOnPRBuild

. $PSScriptRoot/SonarQubePostTestImpl.ps1
. $PSScriptRoot/PRCA/Orchestrator.ps1

. $PSScriptRoot/SonarQubeMetrics.ps1
. $PSScriptRoot/SonarQubeReportHandler.ps1
. $PSScriptRoot/SonarQubeBuildBreaker.ps1


InvokeMSBuildRunnerPostTest
# PRCA
HandleCodeAnalysisReporting

UploadSummaryMdReport
BreakBuildOnQualityGateFailure
