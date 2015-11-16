param(
    [string]$testRunner,    
    [string]$testResultsFiles,
    [string]$mergeTestResults,
    [string]$testRunTitle,
    [string]$platform,
    [string]$configuration,
    [string]$publishRunAttachments
)

Function CmdletHasMember($memberName) {
    $publishParameters = (gcm Publish-TestResults).Parameters.Keys.Contains($memberName) 
    return $publishParameters
}

Write-Verbose "Entering script PublishTestResults.ps1"

# Import the Task.Common, Task.Internal and Task.TestResults dll that has all the cmdlets we need
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"

if(!$testRunner)
{
    Write-Host "##vso[task.logissue type=error;code=003001;]"
    throw (Get-LocalizedString -Key "Test runner parameter has to be specified")
}

if (!$testResultsFiles)
{
    Write-Host "##vso[task.logissue type=error;code=003001;]"
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
    Write-Warning (Get-LocalizedString -Key "No test result files were found using search pattern '{0}'." -ArgumentList $testResultsFiles)
}
else
{
    $publishResultsOption = Convert-String $publishRunAttachments Boolean
    $mergeResults = Convert-String $mergeTestResults Boolean
    Write-Verbose "Calling Publish-TestResults"
        
    $publishRunLevelAttachmentsExists = CmdletHasMember "PublishRunLevelAttachments"
	if([string]::IsNullOrWhiteSpace($testRunTitle))
	{
		if($publishRunLevelAttachmentsExists)
		{
			Publish-TestResults -TestRunner $testRunner -TestResultsFiles $matchingTestResultsFiles -MergeResults $mergeResults -Platform $platform -Configuration $configuration -Context $distributedTaskContext -PublishRunLevelAttachments $publishResultsOption
		}
		else 
		{
			Publish-TestResults -TestRunner $testRunner -TestResultsFiles $matchingTestResultsFiles -MergeResults $mergeResults -Platform $platform -Configuration $configuration -Context $distributedTaskContext
		}
	}
	else
	{
		if($publishRunLevelAttachmentsExists)
		{
			Publish-TestResults -TestRunner $testRunner -TestResultsFiles $matchingTestResultsFiles -MergeResults $mergeResults -Platform $platform -Configuration $configuration -Context $distributedTaskContext -PublishRunLevelAttachments $publishResultsOption -RunTitle $testRunTitle
		}
		else 
		{
			Publish-TestResults -TestRunner $testRunner -TestResultsFiles $matchingTestResultsFiles -MergeResults $mergeResults -Platform $platform -Configuration $configuration -Context $distributedTaskContext -RunTitle $testRunTitle
		}
	}
}

Write-Verbose "Leaving script PublishTestResults.ps1"