Write-Verbose "Starting SonarQube PostBuild Step"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

$bootstrapperPath = Get-TaskVariable -Context $distributedTaskContext -Name "BootstrapperPath" -Global $FALSE
Write-Verbose -Verbose "boots $bootstrapperPath"

if (!$bootstrapperPath -or ![System.IO.File]::Exists($bootstrapperPath))
{
	throw "The SonarQube MsBuild Runner executable could not be found. Does your build definition include the SonarQube Pre-Build step?"
}

Write-Verbose -Verbose "Executing $bootstrapperPath end"
Invoke-BatchScript $bootstrapperPath -Arguments "end"


$agentBuildDirectory = Get-TaskVariable -Context $distributedTaskContext -Name "Agent.BuildDirectory" -Global $FALSE
if (!$agentBuildDirectory)
{
    throw "Could not retrieve the Agent.BuildDirectory variable";
}

# Upload the summary markdown file
$summaryMdPath = [System.IO.Path]::Combine($agentBuildDirectory, ".sonarqube", "out", "summary.md")
Write-Verbose -Verbose "summaryMdPath = $summaryMdPath"

if ([System.IO.File]::Exists($summaryMdPath))
{
	Write-Verbose -Verbose "Uploading the summary.md file"
    Write-Host "##vso[build.uploadsummary]$summaryMdPath"
}
else
{
     Write-Warning "Could not find the summary report file $summaryMdPath"
}


