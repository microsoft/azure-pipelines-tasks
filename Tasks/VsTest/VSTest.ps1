param(
    [string]$vsTestVersion, 
    [string]$testAssembly,
    [string]$testFiltercriteria,
    [string]$runSettingsFile,
    [string]$codeCoverageEnabled,
    [string]$pathtoCustomTestAdapters,
    [string]$overrideTestrunParameters,
    [string]$otherConsoleOptions,
    [string]$platform,
    [string]$configuration
)

Write-Verbose "Entering script VSTestConsole.ps1"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
# Import the Task.TestResults dll that has the cmdlet we need for publishing results
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"

if (!$testAssembly)
{
    throw "testAssembly parameter not set on script"
}

# check for solution pattern
if ($testAssembly.Contains("*") -or $testAssembly.Contains("?"))
{
    Write-Verbose "Pattern found in solution parameter. Calling Find-Files."
    Write-Verbose "Calling Find-Files with pattern: $testAssembly"
    $testAssemblyFiles = Find-Files -SearchPattern $testAssembly
	Write-Verbose "Found files: $testAssemblyFiles"
}
else
{
    Write-Verbose "No Pattern found in solution parameter."
    $testAssemblyFiles = ,$testAssembly
}

$codeCoverage = Convert-String $codeCoverageEnabled Boolean

if($testAssemblyFiles)
{
    Write-Verbose "Calling Invoke-VSTest for all test assemblies"
    $timeline = Start-Timeline -Context $distributedTaskContext
    $projectName = Get-Variable -Context $distributedTaskContext -Name "System.TeamProject"
    $buildDir = Get-Variable -Context $distributedTaskContext -Name "Agent.BuildDirectory" -Global $FALSE
    $buildNumber = Get-Variable -Context $distributedTaskContext -Name "Build.BuildNumber"
    $buildUri = Get-Variable -Context $distributedTaskContext -Name "Build.BuildUri"
    $owner = Get-Variable -Context $distributedTaskContext -Name "Build.RequestedFor"	
    $cwd = $buildDir
    $testResultsDir = $buildDir+"\"+"TestResults"
    Write-Verbose "Calling Invoke-VSTest from working folder: $cwd"
    Invoke-VSTest -TestAssemblies $testAssemblyFiles -Timeline $timeline -VSTestVersion $vsTestVersion -TestFiltercriteria $testFiltercriteria -RunSettingsFile $runSettingsFile -PathtoCustomTestAdapters $pathtoCustomTestAdapters -CodeCoverageEnabled $codeCoverage -OverrideTestrunParameters $overrideTestrunParameters -OtherConsoleOptions $otherConsoleOptions -WorkingFolder $cwd -TestResultsFolder $testResultsDir
    $connection = Get-VssConnection -TaskContext $distributedTaskContext
    Invoke-ResultPublisher -Connection $connection -ProjectName $projectName -Owner $owner -TestResultsFolder $testResultsDir -Extension "trx" -ResultType "Trx" -BuildUri $buildUri -BuildNumber $buildNumber -Platform $platform -Configuration $configuration
}
else
{
    Write-Verbose "No test assemblies found matching the pattern: $testAssembly"
}
Write-Verbose "Leaving script VSTestConsole.ps1"