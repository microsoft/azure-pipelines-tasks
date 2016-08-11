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
    [string]$mavenVersionSelection,
    [string]$mavenPath,
    [string]$mavenSetM2Home,
    [string]$mavenOpts,
    [string]$sqAnalysisEnabled, 
    [string]$sqConnectedServiceName, 
    [string]$sqDbDetailsRequired,
    [string]$sqDbUrl,
    [string]$sqDbUsername,
    [string]$sqDbPassword,
    [string]$pmdAnalysisEnabled
)

Function CmdletHasMember($memberName) {
    $publishParameters = (gcm Publish-TestResults).Parameters.Keys.Contains($memberName) 
    return $publishParameters
}

Function GetMavenToolPath() {
    if(!$mavenPath -or -not (Test-Path $mavenPath))
    {
        throw "Maven path not specified or does not exist"
    }
    # The Maven bin path should contain either mvn.cmd (Maven 3) or mvn.bat (Maven 2)
    $toolPath = gci -Path "$mavenPath" -Filter "mvn.cmd" -Recurse | select -First 1
    if(!$toolPath)
    {
        $toolPath = gci -Path "$mavenPath" -Filter "mvn.bat" -Recurse | select -First 1
    }
    if(!$toolPath)
    {
        throw "Path $mavenPath does not contain a Maven installation"
    }
    Write-Host "Using Maven executable at $($toolPath.FullName)"
    if($mavenSetM2Home -eq $true)
    {
        $env:M2_HOME = $mavenPath
        Write-Host "M2_HOME set to $mavenPath"
    }
    return $toolPath.FullName
}

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

Write-Verbose "mavenVersionSelection = $mavenVersionSelection"
Write-Verbose "mavenPath = $mavenPath"
Write-Verbose "mavenSetM2Home = $mavenSetM2Home"

Write-Verbose "sqAnalysisEnabled = $sqAnalysisEnabled"
Write-Verbose "connectedServiceName = $sqConnectedServiceName"
Write-Verbose "sqDbDetailsRequired = $sqDbDetailsRequired"
Write-Verbose "dbUrl = $sqDbUrl"
Write-Verbose "dbUsername = $sqDbUsername"

# PMD analysis is not supported on Powershell, output a warning message
if($pmdAnalysisEnabled)
{
    Write-Warning "PMD code analysis is not yet supported on Windows and hosted agents."
    Write-Warning "Please use a dedicated Unix agent to enable this feature: https://github.com/Microsoft/vsts-agent"
}

# Verify Maven POM file is specified
if(!$mavenPOMFile)
{
    Write-Host "##vso[task.logissue type=error;code=004001;]"
    throw "Maven POM file is not specified"
}

# Import the Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.CodeCoverage"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"

. ./mavenHelper.ps1

$buildRootPath = Split-Path $mavenPOMFile -Parent
$reportDirectoryName = "ReportDirectoryC91CDE2D"
$reportDirectoryNameCobertura = "target\site\cobertura"
$reportPOMFileName = "ReportPOMFile4E52C1C4.xml"
$reportPOMFile = Join-Path $buildRootPath $reportPOMFileName
$reportDirectory = Join-Path $buildRootPath $reportDirectoryName
$reportDirectoryCobertura = Join-Path $buildRootPath $reportDirectoryNameCobertura
$targetDirectory = Join-Path $buildRootPath "target"
$summaryFileNameJacoco = "jacoco.xml"
$summaryFileNameCobertura = "coverage.xml"
$summaryFileJacoco = Join-Path $buildRootPath $reportDirectoryName
$summaryFileJacoco = Join-Path $summaryFileJacoco $summaryFileNameJacoco
$summaryFileCobertura = Join-Path $buildRootPath $reportDirectoryNameCobertura
$summaryFileCobertura = Join-Path $summaryFileCobertura $summaryFileNameCobertura
$CCReportTask = "jacoco:report"

Write-Verbose "SummaryFileCobertura = $summaryFileCobertura"

Remove-Item -Recurse -Force $reportDirectory -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $reportDirectoryCobertura -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $reportPOMFile -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $targetDirectory -ErrorAction SilentlyContinue

if ($isCoverageEnabled)
{
    Copy-Item $mavenPOMFile "$mavenPOMFile.tmp" -Force -ErrorAction SilentlyContinue
    Set-ItemProperty $mavenPOMFile -Name Attributes -Value Normal -Force -ErrorAction SilentlyContinue
}

# Enable Code Coverage
EnableCodeCoverage $isCoverageEnabled $mavenPOMFile $codeCoverageTool $classFilter $classFilesDirectories $srcDirectories $summaryFileNameJacoco $reportDirectory $reportPOMFile

# Use a specific JDK
ConfigureJDK $javaHomeSelection $jdkVersion $jdkArchitecture $jdkUserInputPath

# Configure the JVM
ConfigureMavenOpts $mavenOpts

# Invoke MVN
Write-Host "Running Maven..."
if($mavenVersionSelection -eq "Default")
{
    Invoke-Maven -MavenPomFile $mavenPOMFile -Options $options -Goals $goals 
}
else
{
    $mavenToolPath = GetMavenToolPath
    Invoke-Maven -MavenPomFile $mavenPOMFile -Options $options -Goals $goals -ToolPath $mavenToolPath
}

# Publish test results
$runTitleMemberExists = CmdletHasMember "RunTitle"
if($runTitleMemberExists)
{
    PublishTestResults $publishJUnitResults $testResultsFiles $testRunTitle
}
else
{
    if(!([string]::IsNullOrWhiteSpace($testRunTitle)))
    {
        Write-Warning "Update the build agent to be able to use the custom run title feature."
    }
    PublishTestResults $publishJUnitResults $testResultsFiles
}

if ($codeCoverageTool -eq "JaCoCo")
{
    #set sonar parameter
    $execFileJacoco = Join-Path $reportDirectory "jacoco.exec"
    # Publish code coverage for Jacoco
    PublishCodeCoverageJacoco  $isCoverageEnabled $mavenPOMFile $CCReportTask $summaryFileJacoco $reportDirectory $codeCoverageTool $reportPOMFile
}
ElseIf ($codeCoverageTool -eq "Cobertura")
{
    # Publish code coverage for Jacoco
    PublishCodeCoverageCobertura  $isCoverageEnabled $mavenPOMFile $summaryFileCobertura $reportDirectoryCobertura $codeCoverageTool
}

# Run SonarQube analysis by invoking Maven with the "sonar:sonar" goal
RunSonarQubeAnalysis $sqAnalysisEnabled $sqConnectedServiceName $sqDbDetailsRequired $sqDbUrl $sqDbUsername $sqDbPassword $options $mavenPOMFile $execFileJacoco

# Reset temp copy and file permissions are reset by default
if ($isCoverageEnabled)
{
    Copy-Item "$mavenPOMFile.tmp" $mavenPOMFile -Force -ErrorAction SilentlyContinue
    Remove-Item "$mavenPOMFile.tmp" -Force -ErrorAction SilentlyContinue
}

Write-Verbose "Leaving script Maven.ps1"
