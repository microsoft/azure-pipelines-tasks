param(
    [string]$wrapperScript,   # Path to gradle wrapper. 
    [string]$cwd,             # Optional - Root directory of gradle project. Defaults to folder of gradle wrapper.
    [string]$options,         # Gradle options
    [string]$tasks,           # Gradle tasks
    [string]$publishJUnitResults,   
    [string]$testResultsFiles,
    [string]$testRunTitle, 
    [string]$codeCoverageTool,
    [string]$classFilesDirectories,
    [string]$classFilter,
    [string]$javaHomeSelection,
    [string]$jdkVersion,      # JDK version
    [string]$jdkArchitecture,  # JDK arch
    [string]$jdkUserInputPath

)

Write-Verbose "Entering script Gradle.ps1"
Write-Verbose "wrapperScript = $wrapperScript"
Write-Verbose "options = $options"
Write-Verbose "tasks = $tasks"
Write-Verbose "publishJUnitResults = $publishJUnitResults"
Write-Verbose "testResultsFiles = $testResultsFiles"
$isCoverageEnabled = !($codeCoverageTool -eq "None")
if($isCoverageEnabled)
{
    Write-Verbose "codeCoverageTool = $codeCoverageTool" 
    Write-Verbose "classFilesDirectory = $classFilesDirectory" 
    Write-Verbose "classFilter = $classFilter"
}

Write-Verbose "javaHomeSelection = $javaHomeSelection"
Write-Verbose "jdkVersion = $jdkVersion"
Write-Verbose "jdkArchitecture = $jdkArchitecture"
Write-Verbose "jdkUserInputPath = $jdkUserInputPath"

# Import the Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"

# Verify wrapperScript is set and is not a container
if(!$wrapperScript -or !(Test-Path -Path $wrapperScript -PathType Leaf)) 
{
    Write-Host "##vso[task.logissue type=error;code=005001;]"
    throw "Please specify the Gradle wrapper script."
}

# Find working directory. cwd is optional, we use directory of wrapper as working directory if not set.
if(!$cwd)
{
    $wrapperScriptItem = Get-Item -Path $wrapperScript
    $cwd = $wrapperScriptItem.Directory.FullName
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

$buildRootPath = $cwd
$wrapperDirectory = Split-Path $wrapperScript -Parent
$reportDirectoryName = [guid]::NewGuid()
$reportDirectory = Join-Path $buildRootPath $reportDirectoryName

# check if project is multi module gradle build or not
$subprojects = Invoke-BatchScript -Path $wrapperScript -Arguments 'properties' -WorkingFolder $buildRootPath | Select-String '^subprojects: (.*)'|ForEach-Object {$_.Matches[0].Groups[1].Value}
Write-Verbose "subprojects: $subprojects"
$singlemodule = [string]::IsNullOrEmpty($subprojects) -or $subprojects -eq '[]'

if($codeCoverageTool -eq "JaCoCo")
{
    $summaryFileName = "summary.xml"

    if($singlemodule)
    {
        $reportingTaskName = "jacocoTestReport"
    }
    else
    {
        $reportingTaskName = "jacocoRootReport"
    }
}
elseif($codeCoverageTool -eq "Cobertura")
{
    $summaryFileName = "coverage.xml"
    $reportingTaskName = "cobertura"
}

$summaryFile = Join-Path $buildRootPath $reportDirectoryName 
$summaryFile = Join-Path $summaryFile $summaryFileName 
$buildFile = Join-Path $buildRootPath "build.gradle"

# check if code coverage has been enabled
if($isCoverageEnabled)
{
   # Enable code coverage in build file
   Enable-CodeCoverage -BuildTool 'Gradle' -BuildFile $buildFile -CodeCoverageTool $codeCoverageTool -ClassFilter $classFilter -ClassFilesDirectories $classFilesDirectories -SummaryFile $summaryFileName -ReportDirectory $reportDirectoryName -IsMultiModule (!$singlemodule) -ErrorAction Stop
   Write-Verbose "Code coverage is successfully enabled." -Verbose
}
else
{
    Write-Verbose "Option to enable code coverage was not selected and is being skipped." -Verbose
}


if($isCoverageEnabled)
{
    $arguments = "$options $tasks $reportingTaskName"
}
else
{
	$arguments = "$options $tasks"
}

Write-Verbose "Invoking Gradle wrapper $wrapperScript $arguments"
Invoke-BatchScript -Path $wrapperScript -Arguments $arguments -WorkingFolder $cwd

# Publish test results files
$publishJUnitResultsFromAntBuild = Convert-String $publishJUnitResults Boolean
if($publishJUnitResultsFromAntBuild)
{
   # check for JUnit test result files
    $matchingTestResultsFiles = Find-Files -SearchPattern $testResultsFiles
    if (!$matchingTestResultsFiles)
    {
        Write-Host "##vso[task.logissue type=warning;code=005002;]"
        Write-Host "No JUnit test results files were found matching pattern '$testResultsFiles', so publishing JUnit test results is being skipped."
    }
    else
    {
        Write-Verbose "Calling Publish-TestResults"
         if([string]::IsNullOrWhiteSpace($testRunTitle))
		{
			Publish-TestResults -TestRunner "JUnit" -TestResultsFiles $matchingTestResultsFiles -Context $distributedTaskContext
		}
		else
		{
			Publish-TestResults -TestRunner "JUnit" -TestResultsFiles $matchingTestResultsFiles -Context $distributedTaskContext -RunTitle $testRunTitle
		}
    }    
}
else
{
    Write-Verbose "Option to publish JUnit Test results produced by Gradle build was not selected and is being skipped."
}


# check if code coverage has been enabled
if($isCoverageEnabled)
{
	if(Test-Path $summaryFile)
	{
		Write-Verbose "Summary file = $summaryFile" -Verbose
		Write-Verbose "Report directory = $reportDirectory" -Verbose
		Write-Verbose "Calling Publish-CodeCoverage" -Verbose
		Publish-CodeCoverage -CodeCoverageTool $codeCoverageTool -SummaryFileLocation $summaryFile -ReportDirectory $reportDirectory -Context $distributedTaskContext   
	}
	else
	{
        Write-Host "##vso[task.logissue type=warning;code=005003;]"
		Write-Warning "No code coverage results found to be published. This could occur if there were no tests executed or there was a build failure. Check the gradle output for details." -Verbose
	}   
}

if(Test-Path $reportDirectory)
{
   # delete any code coverage data 
   rm -r $reportDirectory -force | Out-Null
}


Write-Verbose "Leaving script Gradle.ps1"
