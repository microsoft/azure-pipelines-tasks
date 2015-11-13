param (
    [string]$mavenPOMFile,
    [string]$options,
    [string]$goals,
    [string]$publishJUnitResults,   
    [string]$testResultsFiles,
    [string]$testRunTitle, 
    [string]$codeCoverageTool,
    [string]$classFilter,
    [string]$classFilesDirectories,
    [string]$srcDirectories,
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

$isCoverageEnabled = !($codeCoverageTool -eq "None")
if($isCoverageEnabled -eq $true)
{
    Write-Verbose "codeCoverageTool = $codeCoverageTool" -Verbose
    Write-Verbose "classFilter = $classFilter" -Verbose
	Write-Verbose "classFilesDirectories = $classFilesDirectories" 
	Write-Verbose "srcDirectories = $srcDirectories" 
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
    Write-Host "##vso[task.logissue type=error;code=004001;]"
    throw "Maven POM file is not specified"
}

# Import the Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"

. ./mavenHelper.ps1


$buildRootPath = Split-Path $mavenPOMFile -Parent
$reportDirectoryName = [guid]::NewGuid()
$reportDirectoryNameCobertura = "target\site\cobertura"
$reportPOMFileName = [guid]::NewGuid().tostring() + ".xml"
$reportPOMFile = Join-Path $buildRootPath $reportPOMFileName
$reportDirectory = Join-Path $buildRootPath $reportDirectoryName
$reportDirectoryCobertura = Join-Path $buildRootPath $reportDirectoryNameCobertura
$summaryFileNameJacoco = "jacoco.xml"
$summaryFileNameCobertura = "coverage.xml"
$summaryFileJacoco = Join-Path $buildRootPath $reportDirectoryName
$summaryFileJacoco = Join-Path $summaryFileJacoco $summaryFileNameJacoco
$summaryFileCobertura = Join-Path $buildRootPath $reportDirectoryNameCobertura
$summaryFileCobertura = Join-Path $summaryFileCobertura $summaryFileNameCobertura
$CCReportTask = "jacoco:report"

Write-Verbose "SummaryFileCobertura = $summaryFileCobertura"

# Enable Code Coverage
EnableCodeCoverage $isCoverageEnabled $mavenPOMFile $codeCoverageTool $classFilter $classFilesDirectories $srcDirectories $summaryFileNameJacoco $reportDirectory $reportPOMFile

# Use a specific JDK
ConfigureJDK $javaHomeSelection $jdkVersion $jdkArchitecture $jdkUserInputPath

# Invoke MVN
Write-Host "Running Maven..."
Invoke-Maven -MavenPomFile $mavenPOMFile -Options $options -Goals $goals 

# Publish test results
if([string]::IsNullOrWhiteSpace($testRunTitle))
{
	PublishTestResults $publishJUnitResults $testResultsFiles
}
else
{
	PublishTestResults $publishJUnitResults $testResultsFiles $testRunTitle		
}

if ($codeCoverageTool -eq "JaCoCo")
{
	# Publish code coverage for Jacoco
	PublishCodeCoverageJacoco  $isCoverageEnabled $mavenPOMFile $CCReportTask $summaryFileJacoco $reportDirectory $codeCoverageTool $reportPOMFile
}
ElseIf ($codeCoverageTool -eq "Cobertura")
{
	# Publish code coverage for Jacoco
	PublishCodeCoverageCobertura  $isCoverageEnabled $mavenPOMFile $summaryFileCobertura $reportDirectoryCobertura $codeCoverageTool
}

if(Test-Path $reportDirectory)
{
    # delete any previous code coverage data 
    rm -r $reportDirectory -force | Out-Null
}

if(Test-Path $reportDirectoryCobertura)
{
    # delete any previous code coverage data from Cobertura
    rm -r $reportDirectoryCobertura -force | Out-Null
}

if(Test-Path $reportPOMFile)
{
    # delete any previous code coverage data 
    rm $reportPOMFile -force | Out-Null
}

# Run SonarQube analysis by invoking Maven with the "sonar:sonar" goal
RunSonarQubeAnalysis $sqAnalysisEnabled $sqConnectedServiceName $sqDbDetailsRequired $sqDbUrl $sqDbUsername $sqDbPassword $options $mavenPOMFile

Write-Verbose "Leaving script Maven.ps1"




