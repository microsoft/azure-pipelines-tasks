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
    [string]$classfilesDirectory,
    [string]$classFilter
)

Write-Verbose "Entering script Gradle.ps1"
Write-Verbose "wrapperScript = $wrapperScript"
Write-Verbose "options = $options"
Write-Verbose "tasks = $tasks"
Write-Verbose "publishJUnitResults = $publishJUnitResults"
Write-Verbose "testResultsFiles = $testResultsFiles"
Write-Verbose "codeCoverageTool = $codeCoverageTool"
Write-Verbose "classfilesDirectory = $classfilesDirectory"
Write-Verbose "classFilter = $classFilter"

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
    Write-Verbose "JAVA_HOME set to $env:JAVA_HOME"
}

$arguments = "$options $tasks"
Write-Verbose "Invoking Gradle wrapper $wrapperScript $arguments"
Invoke-BatchScript -Path $wrapperScript -Arguments $arguments -WorkingFolder $cwd

$summaryFile = Join-Path $cwd "build\report.xml"
$reportDirectory = Join-Path $cwd "build"

# check if code coverage has been enabled
if($codeCoverageTool)
{
   # Enable code coverage in build file
   Enable-CodeCoverage -BuildTool 'Gradle' -BuildFile $wrapperScript -CodeCoverageTool $codeCoverageTool -ClassFilter $classFilter -ClassFilesDirectory $classFilesDirectory -SummaryFile $summaryFile -ReportDirectory $reportDirectory
}

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
    Write-Verbose "Option to publish JUnit Test results produced by Gradle build was not selected and is being skipped."
}

# check if code coverage has been enabled
if($codeCoverageTool)
{
   Publish-CodeCoverage -CodeCoverageTool $codeCoverageTool -SummaryFileLocation $summaryFileLocation -ReportDirectory $reportDirectory -AdditionalCodeCoverageFiles $codeCoverageFiles -Context $distributedTaskContext    
}
else
{
    Write-Verbose "Option to publish CodeCoverage results produced by Gradle build was not selected and is being skipped."
}

Write-Verbose "Leaving script Gradle.ps1"
