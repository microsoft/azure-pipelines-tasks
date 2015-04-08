param(
    [string]$testRunner,    
    [string]$testResultsFiles,  
    [string]$cwd,
    [string]$platform,
    [string]$configuration
)

Write-Verbose "Entering script PublishTestResults.ps1"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

if(!$testRunner)
{
    throw "testRunner parameter has to be specified"
}

if (!$testResultsFiles)
{
    throw "testResultsFiles parameter has to be specified"
}

Write-Verbose "Calling Publish-TestResults"
Publish-TestResults -TestRunner $testRunner -TestResultsFiles $testResultsFiles -WorkingFolder $cwd -Platform $platform -Configuration $configuration -Context $distributedTaskContext

Write-Verbose "Leaving script PublishTestResults.ps1"