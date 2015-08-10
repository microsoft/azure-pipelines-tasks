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

# Import the Task.Common and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
# Import the Task.TestResults dll that has the cmdlet we need for publishing results
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"

if (!$testAssembly)
{
    throw (Get-LocalizedString -Key "Test assembly parameter not set on script")
}

# check for solution pattern
if ($testAssembly.Contains("*") -or $testAssembly.Contains("?"))
{
    Write-Verbose "Pattern found in solution parameter. Calling Find-Files."
    Write-Verbose "Calling Find-Files with pattern: $testAssembly"
    $sourcesDirectory = Get-TaskVariable -Context $distributedTaskContext -Name "Build.SourcesDirectory"
    $testAssemblyFiles = Find-Files -SearchPattern $testAssembly -RootFolder $sourcesDirectory
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
    Write-Verbose -Verbose "Calling Invoke-VSTest for all test assemblies"

    if($vsTestVersion -eq "latest")
    {
        # null out vsTestVersion before passing to cmdlet so it will default to the latest on the machine.
        $vsTestVersion = $null
    }

    $artifactsDirectory = Get-TaskVariable -Context $distributedTaskContext -Name "System.ArtifactsDirectory" -Global $FALSE

    $workingDirectory = $artifactsDirectory
    $testResultsDirectory = $workingDirectory + "\" + "TestResults"
    
    Invoke-VSTest -TestAssemblies $testAssemblyFiles -VSTestVersion $vsTestVersion -TestFiltercriteria $testFiltercriteria -RunSettingsFile $runSettingsFile -PathtoCustomTestAdapters $pathtoCustomTestAdapters -CodeCoverageEnabled $codeCoverage -OverrideTestrunParameters $overrideTestrunParameters -OtherConsoleOptions $otherConsoleOptions -WorkingFolder $workingDirectory -TestResultsFolder $testResultsDirectory -SourcesDirectory $sourcesDirectory

    $resultFiles = Find-Files -SearchPattern "*.trx" -RootFolder $testResultsDirectory 

    if($resultFiles) 
    {
        Publish-TestResults -Context $distributedTaskContext -TestResultsFiles $resultFiles -TestRunner "VSTest" -Platform $platform -Configuration $configuration
    }
    else
    {
        Write-Warning "No results found to publish."
    }
}
else
{
    Write-Warning "No test assemblies found matching the pattern: $testAssembly"
}
Write-Verbose "Leaving script VSTestConsole.ps1"