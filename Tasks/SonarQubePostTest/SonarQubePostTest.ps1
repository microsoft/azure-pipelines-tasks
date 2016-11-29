Write-Verbose "Starting SonarQube PostBuild Step"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

Write-Warning "We are transferring ownership of the SonarQube related build tasks to Sonar Source. Please replace these build tasks with the ones provided by Sonar Source. 
To do this, visit the marketplace to install the extension created by Sonar Source: https://aka.ms/sqextension
For more details go to https://aka.ms/sqdeprecation"

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
