Write-Verbose "Starting SonarQube PostBuild Step"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

. $PSScriptRoot/Common/SonarQubeHelpers/SonarQubeHelper.ps1

if ( (IsPrBuild) -and ((GetTaskContextVariable "DisableSQAnalysisOnPrBuilds") -eq "true"))
{
	Write-Host "DisableSQAnalysisOnPrBuilds is set and this is a PR build - ignoring the analysis tasks"
	return
}

. $PSScriptRoot/SonarQubePostTestImpl.ps1
. $PSScriptRoot/SonarQubeBuildBreaker.ps1

# TODO transform this whole thing to a module and import it so that you can hide some complexity ???
. $PSScriptRoot/PRCA/Orchestrator.ps1

InvokeMSBuildRunnerPostTest
UploadSummaryMdReport
HandleCodeAnalysisReporting
BreakBuildOnQualityGateFailure
