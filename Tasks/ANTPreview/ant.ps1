param (
    [string]$antBuildFile,
    [string]$options,
    [string]$targets,
    [string]$publishJUnitResults,   
    [string]$testResultsFiles, 
    [string]$jdkVersion,
    [string]$jdkArchitecture,
	
    [string]$codeCoverageTool,
    [string]$classfilesDirectory,
    [string]$classFilter
)

Write-Verbose 'Entering Ant.ps1'
Write-Verbose "antBuildFile = $antBuildFile"
Write-Verbose "options = $options"
Write-Verbose "targets = $targets"
Write-Verbose "publishJUnitResults = $publishJUnitResults"
Write-Verbose "testResultsFiles = $testResultsFiles"
Write-Verbose "jdkVersion = $jdkVersion"
Write-Verbose "jdkArchitecture = $jdkArchitecture"

$isCoverageEnabled = !$codeCoverageTool.equals("NoCoverage")
if($isCoverageEnabled)
{
    Write-Verbose "codeCoverageTool = $codeCoverageTool"
    Write-Verbose "classfilesDirectory = $classfilesDirectory"
    Write-Verbose "classFilter = $classFilter"
}
	
#Verify Ant build file is specified
if(!$antBuildFile)
{
    throw "Ant build file is not specified"
}

# Import the Task.Common, Task.TestResults and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"

if($jdkVersion -and $jdkVersion -ne "default")
{
    $jdkPath = Get-JavaDevelopmentKitPath -Version $jdkVersion -Arch $jdkArchitecture
    if (!$jdkPath) 
    {
        throw "Could not find JDK $jdkVersion $jdkArchitecture, please make sure the selected JDK is installed properly."
    }

    Write-Host "Setting JAVA_HOME to $jdkPath"
    $env:JAVA_HOME = $jdkPath
    Write-Verbose "JAVA_HOME set to $env:JAVA_HOME"
}

$buildRootPath = Split-Path $antBuildFile -Parent
$summaryFile = Join-Path $buildRootPath "CodeCoverage\summary.xml"
$reportDirectory = Join-Path $buildRootPath "CodeCoverage"

# check if code coverage has been enabled
if($isCoverageEnabled)
{
   # Enable code coverage in build file
   Enable-CodeCoverage -BuildTool 'Ant' -BuildFile $antBuildFile -CodeCoverageTool $codeCoverageTool -ClassFilter $classFilter -ClassFilesDirectory $classFilesDirectory -SummaryFile $summaryFile -ReportDirectory $reportDirectory
}
	

Write-Verbose "Running Ant..."
Invoke-Ant -AntBuildFile $antBuildFile -Options $options -Targets $targets

# Publish test results files
$publishJUnitResultsFromAntBuild = Convert-String $publishJUnitResults Boolean
if($publishJUnitResultsFromAntBuild)
{
   # check for JUnit test result files
    $matchingTestResultsFiles = Find-Files -SearchPattern $testResultsFiles
    if (!$matchingTestResultsFiles)
    {
        Write-Host "No JUnit test results files were found matching pattern '$testResultsFiles', so publishing JUnit test results is being skipped."
    }
    else
    {
        Write-Verbose "Calling Publish-TestResults"
        Publish-TestResults -TestRunner "JUnit" -TestResultsFiles $matchingTestResultsFiles -Context $distributedTaskContext
    }    
}
else
{
    Write-Verbose "Option to publish JUnit Test results produced by Ant build was not selected and is being skipped."
}

# check if code coverage has been enabled
if($isCoverageEnabled)
{
   Publish-CodeCoverage -CodeCoverageTool $codeCoverageTool -SummaryFileLocation $summaryFile -ReportDirectory $reportDirectory -Context $distributedTaskContext    
}
else
{
    Write-Verbose "Option to publish CodeCoverage results produced by Maven build was not selected and is being skipped."
}


Write-Verbose "Leaving script Ant.ps1"




