param(
    [string]$testRunner,    
    [string]$testResultsFiles,
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

Write-Verbose "Calling Publish-TestResults"
Publish-TestResults -TestRunner $testRunner -TestResultsFiles $matchingTestResultsFiles -Platform $platform -Configuration $configuration -Context $distributedTaskContext

Write-Verbose "Leaving script PublishTestResults.ps1"