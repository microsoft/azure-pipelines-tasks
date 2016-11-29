Write-Verbose "Starting SonarQube PostBuild Step"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

Write-Warning " The ownership of the SonarQube related build tasks is being transferred to SonarSource." 
Write-Warning " Please replace this build task with the one brought by SonarSource's extension on the marketplace: https://aka.ms/sqextension"
Write-Warning " For more details go to https://aka.ms/sqtransfer"

. $PSScriptRoot/Common/SonarQubeHelpers/SonarQubeHelper.ps1

# During PR builds only an "issues mode" analysis is allowed. The resulting issues are posted as code review comments. 
# The feature can be toggled by the user and is OFF by default.  
ExitOnPRBuild

. $PSScriptRoot/SonarQubePostTestImpl.ps1
. $PSScriptRoot/PRCA/Orchestrator.ps1

. $PSScriptRoot/SonarQubeMetrics.ps1
. $PSScriptRoot/SummaryReport/ReportBuilder.ps1
. $PSScriptRoot/SonarQubeBuildBreaker.ps1


InvokeMSBuildRunnerPostTest
HandleCodeAnalysisReporting # PRCA
CreateAndUploadReport
BreakBuildOnQualityGateFailure
