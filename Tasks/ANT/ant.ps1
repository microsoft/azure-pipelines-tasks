param (
    [string]$antBuildFile,
    [string]$options,
    [string]$targets,
    [string]$publishJUnitResults,   
    [string]$testResultsFiles,
    [string]$testRunTitle,
    [string]$codeCoverageTool,
    [string]$classFilesDirectories,
    [string]$classFilter,
    [string]$srcDirectories,
    [string]$javaHomeSelection,
    [string]$jdkVersion,
    [string]$jdkArchitecture,
    [string]$jdkUserInputPath,
    [string]$antHomeUserInputPath
)

Function CmdletHasMember($memberName) {
    $publishParameters = (gcm Publish-TestResults).Parameters.Keys.Contains($memberName) 
    return $publishParameters
}

Write-Verbose 'Entering Ant.ps1'
Write-Verbose "antBuildFile = $antBuildFile"
Write-Verbose "options = $options"
Write-Verbose "targets = $targets"
Write-Verbose "publishJUnitResults = $publishJUnitResults"
Write-Verbose "testResultsFiles = $testResultsFiles"
Write-Verbose "javaHomeSelection = $javaHomeSelection"
Write-Verbose "jdkVersion = $jdkVersion"
Write-Verbose "jdkArchitecture = $jdkArchitecture"
Write-Verbose "jdkUserInputPath = $jdkUserInputPath"
Write-Verbose "antHomeUserInputPath = $antHomeUserInputPath"
    
$isCoverageEnabled = !($codeCoverageTool -eq "None")
if($isCoverageEnabled)
{
    Write-Verbose "codeCoverageTool = $codeCoverageTool" 
    Write-Verbose "classFilesDirectories = $classfilesDirectories" 
    Write-Verbose "classFilter = $classFilter" 
    Write-Verbose "srcDirectories = $srcDirectories" 
}
#Verify Ant build file is specified
if(!$antBuildFile)
{
    Write-Host "##vso[task.logissue type=error;code=006001;]"
    throw "Ant build file is not specified"
}

# Import the Task.Common, Task.TestResults and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"

# Determine if ANT_HOME should be set by path provided by user
if($antHomeUserInputPath)
{
    Write-Verbose "Evaluating provided path for ANT_HOME of '$antHomeUserInputPath'"
    if(Test-Path -LiteralPath $antHomeUserInputPath)
    {
        Write-Verbose "Using path from user input to set ANT_HOME"
        Write-Host "Setting ANT_HOME to $antHomeUserInputPath"
        $env:ANT_HOME = $antHomeUserInputPath
        Write-Verbose "ANT_HOME set to $env:ANT_HOME"
    }
    else
    {
        throw (Get-LocalizedString -Key "The specified ANT_HOME path does not exist. Please provide a valid path.")
    }
}

# If JAVA_HOME is being set by choosing a JDK version find the path to that specified version else use the path given by the user
$jdkPath = $null
if($javaHomeSelection -eq 'JDKVersion')
{
    Write-Verbose "Using JDK version to find and set JAVA_HOME"
    # If the JDK version is not the default set the jdkPath to the new JDK version selected
    if($jdkVersion -and ($jdkVersion -ne "default"))
     {
        $jdkPath = Get-JavaDevelopmentKitPath -Version $jdkVersion -Arch $jdkArchitecture
        if (!$jdkPath) 
        {
            throw (Get-LocalizedString -Key 'Could not find JDK {0} {1}. Please make sure the selected JDK is installed properly.' -ArgumentList $jdkVersion, $jdkArchitecture)
        }
     }
}
else
{
    Write-Verbose "Using path from user input to set JAVA_HOME"
    if($jdkUserInputPath -and (Test-Path -LiteralPath $jdkUserInputPath))
    {
        $jdkPath = $jdkUserInputPath
    }
    else
    {
         throw (Get-LocalizedString -Key "The specified JDK path does not exist. Please provide a valid path.")
    }
}
 
# If jdkPath is set to something other than the default then update JAVA_HOME
if ($jdkPath)
{
    Write-Host "Setting JAVA_HOME to $jdkPath"
    $env:JAVA_HOME = $jdkPath
    Write-Verbose "JAVA_HOME set to $env:JAVA_HOME"
}

$buildRootPath = Split-Path $antBuildFile -Parent
$reportDirectoryName = [guid]::NewGuid()
$reportDirectory = Join-Path $buildRootPath $reportDirectoryName

if($isCoverageEnabled)
{
	if ($codeCoverageTool -eq "Cobertura")
	{
		$summaryFileName = "coverage.xml"
	}
	ElseIf ($codeCoverageTool -eq "JaCoCo")
	{
		$summaryFileName = "summary.xml"
	}
}



$summaryFile = Join-Path $buildRootPath $reportDirectoryName 
$summaryFile = Join-Path $summaryFile $summaryFileName
# ensuring unique code coverage report task name by using guid
$CCReportTask = "CodeCoverage_" +[guid]::NewGuid()

$reportBuildFileName = [guid]::NewGuid().tostring() + ".xml"
$reportBuildFile = Join-Path $buildRootPath $reportBuildFileName
$instrumentedClassesDirectory = Join-Path $buildRootPath "InstrumentedClasses"

if($isCoverageEnabled)
{
   try
   {
	# Enable code coverage in build file
	if ($codeCoverageTool -eq "Cobertura")
	{
		$coberturaCCFile = Join-Path $buildRootPath "cobertura.cer"
		if(Test-Path $coberturaCCFile)
		{
			# delete any previous cobertura code coverage file
			rm -r $coberturaCCFile -force | Out-Null
		}		
		
		if(Test-Path $instrumentedClassesDirectory)
		{
			# delete any previous cobertura instrumented classes
			rm -r $instrumentedClassesDirectory -force | Out-Null
		}
	}
	
	Enable-CodeCoverage -BuildTool 'Ant' -BuildFile $antBuildFile -CodeCoverageTool $codeCoverageTool -ClassFilter $classFilter -ClassFilesDirectories $classFilesDirectories -SourceDirectories $srcDirectories -SummaryFile $summaryFileName -ReportDirectory $reportDirectory -CCReportTask $CCReportTask -ReportBuildFile $reportBuildFile
	Write-Verbose "Code coverage is successfully enabled." -Verbose
   }
   catch
   {
	Write-Warning "Enabling code coverage failed. Check the build logs for errors" -Verbose
   }
}
else
{
    Write-Verbose "Option to enable code coverage was not selected and is being skipped." -Verbose
}	

Write-Verbose "Running Ant..." -Verbose
Invoke-Ant -AntBuildFile $antBuildFile -Options $options -Targets $targets

# Publish test results files
$publishJUnitResultsFromAntBuild = Convert-String $publishJUnitResults Boolean
if($publishJUnitResultsFromAntBuild)
{
   # check for JUnit test result files
    $matchingTestResultsFiles = Find-Files -SearchPattern $testResultsFiles
    if (!$matchingTestResultsFiles)
    {
        Write-Host "##vso[task.logissue type=warning;code=006002;]"
        Write-Host "No JUnit test results files were found matching pattern '$testResultsFiles', so publishing JUnit test results is being skipped."
    }
    else
    {
        Write-Verbose "Calling Publish-TestResults"
	$runTitleMemberExists = CmdletHasMember "RunTitle"
	if($runTitleMemberExists)
	{
		Publish-TestResults -TestRunner "JUnit" -TestResultsFiles $matchingTestResultsFiles -Context $distributedTaskContext -RunTitle $testRunTitle -MergeResults $true
	}
	else
	{
		if(!([string]::IsNullOrWhiteSpace($testRunTitle)))
		{
			Write-Warning "Update the build agent to be able to use the custom run title feature."
		}
		Publish-TestResults -TestRunner "JUnit" -TestResultsFiles $matchingTestResultsFiles -Context $distributedTaskContext -MergeResults $true
	}
    }    
}
else
{
    Write-Verbose "Option to publish JUnit Test results produced by Ant build was not selected and is being skipped."
}

# check if code coverage has been enabled
if($isCoverageEnabled)
{
	
   # run report code coverage task which generates code coverage reports.
   $reportsGenerationFailed = $false
   Write-Verbose "Collecting code coverage reports" -Verbose
   try
   {
	if(Test-Path $reportBuildFile)
	{
		# This will handle compat between S91 and S92
		Invoke-Ant -AntBuildFile $reportBuildFile -Targets $CCReportTask
	}
	else
	{
		Invoke-Ant -AntBuildFile $antBuildFile -Targets $CCReportTask
	}
   }
   catch
   {
	$reportsGenerationFailed = $true
   }
   
	
	if(-not $reportsGenerationFailed -and (Test-Path $summaryFile))
   	{
		Write-Verbose "Summary file = $summaryFile" -Verbose
		Write-Verbose "Report directory = $reportDirectory" -Verbose
		Write-Verbose "Calling Publish-CodeCoverage" -Verbose
		Publish-CodeCoverage -CodeCoverageTool $codeCoverageTool -SummaryFileLocation $summaryFile -ReportDirectory $reportDirectory -Context $distributedTaskContext    
   	}
   	else
   	{
        	Write-Host "##vso[task.logissue type=warning;code=006003;]"
		Write-Warning "No code coverage results found to be published. This could occur if there were no tests executed or there was a build failure. Check the ant output for details." -Verbose
   	}
}

if(Test-Path $reportDirectory)
{
   # delete any previous code coverage data 
   rm -r $reportDirectory -force | Out-Null
}

if(Test-Path $reportBuildFile)
{
   # delete any previous code coverage report build file
   rm -r $reportBuildFile -force | Out-Null
}

if(Test-Path $instrumentedClassesDirectory)
{
   # delete any previous instrumented classes directory
   rm -r $instrumentedClassesDirectory -force | Out-Null
}
Write-Verbose "Leaving script Ant.ps1"




