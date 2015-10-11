param (
    [string]$mavenPOMFile,
    [string]$options,
    [string]$goals,
    [string]$publishJUnitResults,   
    [string]$testResultsFiles, 
    [string]$codeCoverageTool,
    [string]$classFilter,
    [string]$javaHomeSelection,
    [string]$jdkVersion,
    [string]$jdkArchitecture,
    [string]$jdkUserInputPath, 
	[string]$sqAnalysisEnabled, 
    [string]$sqConnectedServiceName, 
    [string]$sqDbDetailsRequired,
    [string]$sqDbUrl,
	[string]$sqDbUsername,
	[string]$sqDbPassword
)

Write-Verbose 'Entering Maven.ps1'
Write-Verbose "mavenPOMFile = $mavenPOMFile"
Write-Verbose "options = $options"
Write-Verbose "goals = $goals"
Write-Verbose "publishJUnitResults = $publishJUnitResults"
Write-Verbose "testResultsFiles = $testResultsFiles"

$isCoverageEnabled = !$codeCoverageTool.equals("None")
if($isCoverageEnabled -eq $true)
{
    Write-Verbose "codeCoverageTool = $codeCoverageTool" -Verbose
    Write-Verbose "classFilter = $classFilter" -Verbose
}

Write-Verbose "javaHomeSelection = $javaHomeSelection"
Write-Verbose "jdkVersion = $jdkVersion"
Write-Verbose "jdkArchitecture = $jdkArchitecture"
Write-Verbose "jdkUserInputPath = $jdkUserInputPath"

Write-Verbose "sqAnalysisEnabled = $sqAnalysisEnabled"
Write-Verbose "connectedServiceName = $sqConnectedServiceName"
Write-Verbose "sqDbDetailsRequired = $sqDbDetailsRequired"
Write-Verbose "dbUrl = $sqDbUrl"
Write-Verbose "dbUsername = $sqDbUsername"

# Verify Maven POM file is specified
if(!$mavenPOMFile)
{
    throw "Maven POM file is not specified"
}

# Import the Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"

. ./mavenHelper.ps1


$buildRootPath = Split-Path $mavenPOMFile -Parent
$reportDirectoryName = [guid]::NewGuid()
$reportDirectory = Join-Path $buildRootPath $reportDirectoryName
$summaryFileName = "jacoco.xml"
$summaryFile = Join-Path $buildRootPath $reportDirectoryName 
$summaryFile = Join-Path $summaryFile $summaryFileName
$CCReportTask = "jacoco:report"

# Enable Code Coverage
EnableCodeCoverage $isCoverageEnabled $reportDirectory $mavenPOMFile $codeCoverageTool $classFilter $summaryFileName $reportDirectoryName

# Use a specific JDK
ConfigureJDK $javaHomeSelection $jdkVersion $jdkArchitecture $jdkUserInputPath

# Invoke MVN
Write-Host "Running Maven..."
Invoke-Maven -MavenPomFile $mavenPOMFile -Options $options -Goals $goals 

# Publish test results
PublishTestResults $publishJUnitResults $testResultsFiles

# Publish code coverage
PublishCodeCoverage  $isCoverageEnabled $mavenPOMFile $CCReportTask $summaryFile $reportDirectory $codeCoverageTool 

if(Test-Path $reportDirectory)
{
    # delete any previous code coverage data 
    rm -r $reportDirectory -force | Out-Null
}

# Run SonarQube analysis by invoking Maven with the "sonar:sonar" goal
RunSonarQubeAnalysis $sqAnalysisEnabled $sqConnectedServiceName $sqDbDetailsRequired $sqDbUrl $sqDbUsername $sqDbPassword $options $mavenPOMFile

Write-Verbose "Leaving script Maven.ps1"




