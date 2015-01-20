param(
    [string]$vsTestVersion, 
    [string]$testAssembly,
    [string]$testFiltercriteria,
    [string]$runSettingsFile,
    [string]$codeCoverageEnabled,
    [string]$pathtoCustomTestAdapters,
    [string]$otherConsoleOptions
)

Write-Verbose "Entering script VSTestConsole.ps1"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

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
	$cwd = Get-Location  
    Write-Verbose "Calling Invoke-VSTest from working folder: $cwd"
    Invoke-VSTest -TestAssemblies $testAssemblyFiles -Timeline $timeline -VSTestVersion $vsTestVersion -TestFiltercriteria $testFiltercriteria -RunSettingsFile $runSettingsFile -PathtoCustomTestAdapters $pathtoCustomTestAdapters -CodeCoverageEnabled $codeCoverage -OtherConsoleOptions $otherConsoleOptions -WorkingFolder $cwd
}
else
{
    Write-Verbose "No test assemblies found matching the pattern: $testAssembly"
}
Write-Verbose "Leaving script VSTestConsole.ps1"