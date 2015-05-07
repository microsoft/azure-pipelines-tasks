param(
    [string]$testRunner,    
    [string]$testResultsFiles,
    [string]$mergeTestResults,
    [string]$platform,
    [string]$configuration
)

Write-Verbose "Entering script PublishTestResults.ps1"

# Import the Task.Common and Task.TestResults dll that has all the cmdlets we need
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"

if(!$testRunner)
{
    throw "testRunner parameter has to be specified"
}

if (!$testResultsFiles)
{
    throw "testResultsFiles parameter has to be specified"
}

# check for pattern in testResultsFiles
if ($testResultsFiles.Contains("*") -or $testResultsFiles.Contains("?"))
{
    Write-Verbose "Pattern found in testResultsFiles parameter."
    Write-Verbose "Find-Files -SearchPattern $testResultsFiles"
    $matchingTestResultsFiles = Find-Files -SearchPattern $testResultsFiles
    Write-Verbose "matchingTestResultsFiles = $matchingTestResultsFiles"
}
else
{
    Write-Verbose "No Pattern found in testResultsFiles parameter."
    $matchingTestResultsFiles = ,$testResultsFiles
}

if (!$matchingTestResultsFiles)
{
    throw "No test results files with search pattern '$testResultsFiles' were found."
}

$mergeResults = Convert-String $mergeTestResults Boolean

Write-Verbose "Calling Publish-TestResults"
Publish-TestResults -TestRunner $testRunner -TestResultsFiles $matchingTestResultsFiles -MergeResults $mergeResults -Platform $platform -Configuration $configuration -Context $distributedTaskContext

Write-Verbose "Leaving script PublishTestResults.ps1"