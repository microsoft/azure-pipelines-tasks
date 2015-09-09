param(
    [string]$wrapperScript,   # Path to gradle wrapper. 
    [string]$cwd,             # Optional - Root directory of gradle project. Defaults to folder of gradle wrapper.
    [string]$options,         # Gradle options
    [string]$tasks,           # Gradle tasks
    [string]$publishJUnitResults,   
    [string]$testResultsFiles, 
    [string]$jdkVersion,      # JDK version
    [string]$jdkArchitecture,  # JDK arch
	
    [string]$codeCoverageTool,
    [string]$classFilesDirectory,
    [string]$classFilter
)

Write-Verbose "Entering script Gradle.ps1" -Verbose
Write-Verbose "wrapperScript = $wrapperScript" -Verbose
Write-Verbose "options = $options" -Verbose
Write-Verbose "tasks = $tasks" -Verbose
Write-Verbose "publishJUnitResults = $publishJUnitResults" -Verbose
Write-Verbose "testResultsFiles = $testResultsFiles" -Verbose

$isCoverageEnabled = !$codeCoverageTool.equals("NoCoverage")
if($isCoverageEnabled)
{
    Write-Verbose "codeCoverageTool = $codeCoverageTool" -Verbose
    Write-Verbose "classFilesDirectory = $classFilesDirectory" -Verbose
    Write-Verbose "classFilter = $classFilter" -Verbose
}

# Import the Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"

# Verify wrapperScript is set and is not a container
if(!$wrapperScript -or !(Test-Path -Path $wrapperScript -PathType Leaf)) 
{
    throw "Please specify the Gradle wrapper script."
}

# Find working directory. cwd is optional, we use directory of wrapper as working directory if not set.
if(!$cwd)
{
    $wrapperScriptItem = Get-Item -Path $wrapperScript
    $cwd = $wrapperScriptItem.Directory.FullName
}

if($jdkVersion -and $jdkVersion -ne "default")
{
    $jdkPath = Get-JavaDevelopmentKitPath -Version $jdkVersion -Arch $jdkArchitecture
    if (!$jdkPath) 
    {
        throw "Could not find JDK $jdkVersion $jdkArchitecture, please make sure the selected JDK is installed properly"
    }

    Write-Host "Setting JAVA_HOME to $jdkPath"
    $env:JAVA_HOME = $jdkPath
    Write-Verbose "JAVA_HOME set to $env:JAVA_HOME" -Verbose
}

$buildRootPath = Split-Path $wrapperScript -Parent
$reportDirectoryName = "CodeCoverage"
$reportDirectory = Join-Path $buildRootPath $reportDirectoryName

if(Test-Path $reportDirectory)
{
   # delete any previous code coverage data 
   rm -r $reportDirectory -force | Out-Null
}

$summaryFileName = "summary.xml"
$summaryFile = Join-Path $buildRootPath $reportDirectoryName 
$summaryFile = Join-Path $summaryFile $summaryFileName

# check if code coverage has been enabled
if($isCoverageEnabled)
{
   # Enable code coverage in build file
   Enable-CodeCoverage -BuildTool 'Gradle' -BuildFile $wrapperScript -CodeCoverageTool $codeCoverageTool -ClassFilter $classFilter -ClassFilesDirectory $classFilesDirectory -SummaryFile $summaryFileName -ReportDirectory $reportDirectoryName
   Write-Verbose "Code coverage is successfully enabled." -Verbose
}
else
{
    Write-Verbose "Option to enable code coverage was not selected and is being skipped." -Verbose
}

$arguments = "$options $tasks"
Write-Verbose "Invoking Gradle wrapper $wrapperScript $arguments" -Verbose
Invoke-BatchScript -Path $wrapperScript -Arguments $arguments -WorkingFolder $cwd

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
        Write-Verbose "Calling Publish-TestResults" -Verbose
        Publish-TestResults -TestRunner "JUnit" -TestResultsFiles $matchingTestResultsFiles -Context $distributedTaskContext
    }    
}
else
{
    Write-Verbose "Option to publish JUnit Test results produced by Gradle build was not selected and is being skipped." -Verbose
}

# check if code coverage has been enabled
if($isCoverageEnabled)
{
   Write-Verbose "Calling Publish-CodeCoverage" -Verbose
   Publish-CodeCoverage -CodeCoverageTool $codeCoverageTool -SummaryFileLocation $summaryFile -ReportDirectory $reportDirectory -Context $distributedTaskContext    
}

Write-Verbose "Leaving script Gradle.ps1" -Verbose