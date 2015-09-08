param (
    [string]$antBuildFile,
    [string]$options,
    [string]$targets,
    [string]$publishJUnitResults,   
    [string]$testResultsFiles, 
    [string]$jdkVersion,
    [string]$jdkArchitecture,
	
    [string]$codeCoverageTool,
    [string]$classFilesDirectory,
    [string]$classFilter,
    [string]$srcDirectory
)

Write-Verbose 'Entering Ant.ps1' -Verbose
Write-Verbose "antBuildFile = $antBuildFile" -Verbose
Write-Verbose "options = $options" -Verbose
Write-Verbose "targets = $targets" -Verbose
Write-Verbose "publishJUnitResults = $publishJUnitResults" -Verbose
Write-Verbose "testResultsFiles = $testResultsFiles" -Verbose
Write-Verbose "jdkVersion = $jdkVersion" -Verbose
Write-Verbose "jdkArchitecture = $jdkArchitecture" -Verbose

$isCoverageEnabled = !$codeCoverageTool.equals("NoCoverage")
if($isCoverageEnabled)
{
    Write-Verbose "codeCoverageTool = $codeCoverageTool" -Verbose
    Write-Verbose "classFilesDirectory = $classFilesDirectory" -Verbose
    Write-Verbose "classFilter = $classFilter" -Verbose
    Write-Verbose "srcDirectory = $srcDirectory" -Verbose
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
    Write-Verbose "JAVA_HOME set to $env:JAVA_HOME" -Verbose
}

$buildRootPath = Split-Path $antBuildFile -Parent
$reportDirectoryName = "CodeCoverage"
$reportDirectory = Join-Path $buildRootPath $reportDirectoryName

if(Test-Path $reportDirectory)
{
   # delete any previous code coverage data 
   rm -r $reportDirectory -force 
}

$summaryFileName = "summary.xml"
$summaryFile = Join-Path $buildRootPath $reportDirectoryName 
$summaryFile = Join-Path $summaryFile $summaryFileName
# ensuring unique code coverage report task name by using guid
$CCReportTask = "CodeCoverage_" +[guid]::NewGuid()

if($isCoverageEnabled)
{
   # Enable code coverage in build file
   Enable-CodeCoverage -BuildTool 'Ant' -BuildFile $antBuildFile -CodeCoverageTool $codeCoverageTool -ClassFilter $classFilter -ClassFilesDirectory $classFilesDirectory -SourceDirectory $srcDirectory -SummaryFile $summaryFileName -ReportDirectory $reportDirectoryName -CCReportTask $CCReportTask
   Write-Verbose "code coverage is successfully enabled." -Verbose
}
else
{
    Write-Verbose "Option to enable code coverage was not selected and is being skipped." -Verbose
}	

Write-Verbose "Running Ant..." -Verbose
Invoke-Ant -AntBuildFile $antBuildFile -Options $options -Targets $targets

if($isCoverageEnabled)
{
   # run report code coverage task which generates code coverage reports.
   Write-Verbose "Reporting code coverage" -Verbose
   Invoke-Ant -AntBuildFile $antBuildFile -Targets $CCReportTask
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
        Write-Verbose "Calling Publish-TestResults" -Verbose
        Publish-TestResults -TestRunner "JUnit" -TestResultsFiles $matchingTestResultsFiles -Context $distributedTaskContext
    }    
}
else
{
    Write-Verbose "Option to publish JUnit Test results produced by Ant build was not selected and is being skipped." -Verbose
}

# check if code coverage has been enabled
if($isCoverageEnabled)
{
   Write-Verbose "Calling Publish-CodeCoverage" -Verbose
   Publish-CodeCoverage -CodeCoverageTool $codeCoverageTool -SummaryFileLocation $summaryFile -ReportDirectory $reportDirectory -Context $distributedTaskContext    
}

Write-Verbose "Leaving script Ant.ps1" -Verbose




