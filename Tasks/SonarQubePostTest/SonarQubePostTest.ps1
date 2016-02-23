Write-Verbose "Starting SonarQube PostBuild Step"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

. $PSScriptRoot/Common/SonarQubeHelpers/SonarQubeHelper.ps1
. $PSScriptRoot//SonarQubePostTestImpl.ps1
. $PSScriptRoot//SonarQubeBuildBreaker.ps1

InvokeMSBuildRunnerPostTest
UploadSummaryMdReport
BreakBuildOnQualityGateFailure
