param(
    [string]$environment,
    [string]$alternateCredsUserName,
    [string]$alternateCredsPassword, 
    [string]$sourcefilters,
    [string]$testFilterCriteria,
    [string]$runSettingsFile,
	[string]$overrideRunParams
)

Write-Verbose "Entering script RunDistributedTests.ps1"
Write-Verbose "environment = $environment"
Write-Verbose "Source Filter = $sourcefilters"
Write-Verbose "testFilterCriteria = $testFilterCriteria"
Write-Verbose "runSettingsFile = $runSettingsFile"
Write-Verbose "AlternateuserName = $alternateCredsUserName"
Write-Verbose "TestRun Parameters to override = $overrideRunParams"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DistributedTestAutomation"

Write-Verbose "Calling Invoke-RunDistributedTests"
Invoke-RunDistributedTests -EnvironmentName $environment -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -AlternateCredUserName $alternateCredsUserName -AlternateCredPassword $alternateCredsPassword

Write-Verbose "Leaving script RunDistributedTests.ps1"
