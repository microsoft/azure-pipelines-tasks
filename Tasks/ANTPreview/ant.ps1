param (
    [string]$antBuildFile,
    [string]$options,
    [string]$targets,
    [string]$publishJUnitResults,   
    [string]$testResultsFiles, 
    [string]$jdkVersion,
    [string]$jdkArchitecture,
	
    [string]$publishCodeCoverageResults,
    [string]$codeCoverageTool,
    [string]$summaryFileLocation,
    [string]$reportDirectory,
    [string]$additionalCodeCoverageFiles
)

Write-Verbose 'Entering Ant.ps1'
Write-Verbose "antBuildFile = $antBuildFile"
Write-Verbose "options = $options"
Write-Verbose "targets = $targets"
Write-Verbose "publishJUnitResults = $publishJUnitResults"
Write-Verbose "testResultsFiles = $testResultsFiles"
Write-Verbose "jdkVersion = $jdkVersion"
Write-Verbose "jdkArchitecture = $jdkArchitecture"

Write-Verbose "publishCodeCoverageResults = $publishCodeCoverageResults"
Write-Verbose "codeCoverageTool = $codeCoverageTool"
Write-Verbose "summaryFileLocation = $summaryFileLocation"
Write-Verbose "reportDirectory = $reportDirectory"
Write-Verbose "additionalCodeCoverageFiles = $additionalCodeCoverageFiles"

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


if($publishCodeCoverageResults)
{
   # Publish Code Coverage Files
   $codeCoverageFiles = Find-Files -SearchPattern $additionalCodeCoverageFiles
   
   if(-not $codeCoverageFiles)
   {
      Write-Warning "No code coverage files matching pattern '$additionalCodeCoverageFiles' were found."  
   }
   
   Publish-CodeCoverage -CodeCoverageTool $codeCoverageTool -SummaryFileLocation $summaryFileLocation -ReportDirectory $reportDirectory -AdditionalCodeCoverageFiles $codeCoverageFiles -Context $distributedTaskContext    
}
else
{
    Write-Verbose "Option to publish CodeCoverage results produced by Maven build was not selected and is being skipped."
}


Write-Verbose "Leaving script Ant.ps1"




