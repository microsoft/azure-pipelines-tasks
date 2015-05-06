param(
    [string]$testRunner,    
    [string]$testResultsFiles,
    [string]$mergeTestResults,
    [string]$platform,
    [string]$configuration
)

Write-Verbose "Entering script PublishTestResults.ps1"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

if(!$testRunner)
{
    throw (Get-LocalizedString -Key "Test runner parameter has to be specified")
}

if (!$testResultsFiles)
{
    throw (Get-LocalizedString -Key "Test results files parameter has to be specified")
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
    throw (Get-LocalizedString -Key "No test results files with search pattern '{0}' were found." -ArgumentList $testResultsFiles)
}

$mergeResults = Convert-String $mergeTestResults Boolean

Write-Verbose "Calling Publish-TestResults"
Publish-TestResults -TestRunner $testRunner -TestResultsFiles $matchingTestResultsFiles -MergeResults $mergeResults -Platform $platform -Configuration $configuration -Context $distributedTaskContext

Write-Verbose "Leaving script PublishTestResults.ps1"