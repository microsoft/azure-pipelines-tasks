param(
    [string]$jUnitResultFiles,  
    [string]$cwd      
)

Write-Verbose "Entering script PublishJUnitResults.ps1"

Write-Verbose "Setting working directory to $cwd"
Set-Location $cwd

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

if (!$jUnitResultFiles)
{
    throw "jUnitResultFiles parameter is not set"
}

Write-Verbose "Calling Publish-JUnitResults for all test results"
Publish-JUnitResults -JUnitResultsFiles $jUnitResultFiles -WorkingFolder $cwd

Write-Verbose "Leaving script PublishJUnitResults.ps1"