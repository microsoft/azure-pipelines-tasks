Write-Verbose "Starting SonarQube PostBuild Step"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

. ./SonarQubePostTestImpl.ps1
. .\CodeAnalysisFilePathComputation.ps1

InvokeMsBuildRunnerPostTest
UploadSummaryMdReport
HandleCodeAnalysisReporting

