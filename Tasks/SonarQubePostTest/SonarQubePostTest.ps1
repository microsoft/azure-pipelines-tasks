Write-Verbose "Starting SonarQube PostBuild Step"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

. ./SonarQubeHelper.ps1
. ./SonarQubePostTestImpl.ps1
. ./SonarQubeBuildBreaker.ps1
. ./CodeAnalysisFilePathComputation.ps1

InvokeMSBuildRunnerPostTest
UploadSummaryMdReport
HandleCodeAnalysisReporting
BreakBuildOnQualityGateFailure
