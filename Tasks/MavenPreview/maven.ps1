param (
    [string]$mavenPOMFile,
    [string]$options,
    [string]$goals,
    [string]$publishJUnitResults,   
    [string]$testResultsFiles, 
    [string]$codeCoverageTool,
    [string]$classFilter,
    [string]$jdkVersion,
    [string]$jdkArchitecture
)

Write-Verbose 'Entering Maven.ps1' -Verbose
Write-Verbose "mavenPOMFile = $mavenPOMFile" -Verbose
Write-Verbose "options = $options" -Verbose
Write-Verbose "goals = $goals" -Verbose
Write-Verbose "publishJUnitResults = $publishJUnitResults" -Verbose
Write-Verbose "testResultsFiles = $testResultsFiles" -Verbose

$isCoverageEnabled = !$codeCoverageTool.equals("NoCoverage")
if($isCoverageEnabled -eq $true)
{
    Write-Verbose "codeCoverageTool = $codeCoverageTool" -Verbose
    Write-Verbose "classFilter = $classFilter" -Verbose
}

#Verify Maven POM file is specified
if(!$mavenPOMFile)
{
    throw "Maven POM file is not specified"
}

# Import the Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"

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

$buildRootPath = Split-Path $mavenPOMFile -Parent
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
$CCReportTask = "jacoco:report"

# check if code coverage has been enabled
if($isCoverageEnabled)
{
   # Enable code coverage in build file
   Enable-CodeCoverage -BuildTool 'Maven' -BuildFile $mavenPOMFile -CodeCoverageTool $codeCoverageTool -ClassFilter $classFilter -SummaryFile $summaryFileName -ReportDirectory $reportDirectoryName
   Write-Verbose "Code coverage is successfully enabled." -Verbose
}
else
{
    Write-Verbose "Option to enable code coverage was not selected and is being skipped." -Verbose
}

Invoke-Maven -MavenPomFile $mavenPOMFile -Options $options -Goals $goals

if($isCoverageEnabled)
{
   # run report code coverage task which generates code coverage reports.
   Write-Verbose "Reporting code coverage" -Verbose
   Invoke-Maven -MavenPomFile $mavenPOMFile -Goals $CCReportTask
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
    Write-Verbose "Option to publish JUnit Test results produced by Maven build was not selected and is being skipped." -Verbose
}

# check if code coverage has been enabled
if($isCoverageEnabled)
{
   Write-Verbose "Calling Publish-CodeCoverage" -Verbose
   Publish-CodeCoverage -CodeCoverageTool $codeCoverageTool -SummaryFileLocation $summaryFile -ReportDirectory $reportDirectory -Context $distributedTaskContext    
}

Write-Verbose "Leaving script Maven.ps1" -Verbose