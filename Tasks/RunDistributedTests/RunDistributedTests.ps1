param(
    [string]$environment, 
    [string]$testassemblies,
    [string]$testFilterCriteria,
    [string]$runSettingsFile,
    [string]$customAdapterPath
)

Write-Verbose "Entering script RunDistributedTests.ps1"
Write-Verbose "environment = $environment"
Write-Verbose "testassemblies = $testassemblies"
Write-Verbose "testFilterCriteria = $testFilterCriteria"
Write-Verbose "runSettingsFile = $runSettingsFile"
Write-Verbose "customAdapterPath = $customAdapterPath"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DistributedTestAutomation"

Write-Verbose "Calling Invoke-RunDistributedTests"
Invoke-RunDistributedTests -EnvironmentName $environment -SourceFilter $testassemblies -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -CustomAdapterPath $customAdapterPath

Write-Verbose "Leaving script RunDistributedTests.ps1"
