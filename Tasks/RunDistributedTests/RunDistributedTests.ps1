param(
    [string]$testMachineGroup,
    [string]$dropLocation,
    [string]$sourcefilters,
    [string]$testFilterCriteria,
    [string]$testRunTitle,
    [string]$platform,
    [string]$configuration,
    [string]$runSettingsFile,
    [string]$codeCoverageEnabled,
    [string]$overrideRunParams,
    [string]$testConfigurations,
    [string]$autMachineGroup,
    [string]$testSelection,
    [string]$testPlan,
    [string]$testSuite,
    [string]$testConfiguration
)

Function CmdletHasMember($memberName) {
    $publishParameters = (gcm Invoke-RunDistributedTests).Parameters.Keys.Contains($memberName) 
    return $publishParameters
}

Write-Verbose "Entering script RunDistributedTests.ps1"
Write-Verbose "TestMachineGroup = $testMachineGroup"
Write-Verbose "Test Drop Location = $dropLocation"
Write-Verbose "Source Filter = $sourcefilters"
Write-Verbose "Test Filter Criteria = $testFilterCriteria"
Write-Verbose "RunSettings File = $runSettingsFile"
Write-Verbose "Build Platform = $platform"
Write-Verbose "Build Configuration = $configuration"
Write-Verbose "CodeCoverage Enabled = $codeCoverageEnabled"
Write-Verbose "TestRun Parameters to override = $overrideRunParams"
Write-Verbose "TestConfiguration = $testConfigurations"
Write-Verbose "Application Under Test Machine Group = $autTestMachineGroup"

# Import the Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DTA"

Write-Verbose "Getting the connection object"
$connection = Get-VssConnection -TaskContext $distributedTaskContext

# Get current directory.
$currentDirectory = Convert-Path .
$unregisterTestAgentScriptLocation = Join-Path -Path $currentDirectory -ChildPath "TestAgentUnRegistration.ps1"
Write-Verbose "UnregisterTestAgent script Path  = $unRegisterTestAgentLocation"

Write-Verbose "Calling Invoke-RunDistributedTests"

$runTitleMemberExists = CmdletHasMember "TestRunTitle"
$testSelectionMemberExists  = CmdletHasMember "TestSelection"

$suites = $testSuite.Split(",")
$testSuites = @()
foreach ($suite in $suites)
{
    $suiteId = 0
    if([int]::TryParse($suite, [ref]$suiteId))
    {
        $testSuites += $suiteId
    }    
}

$testPlanId = 0
if([int]::TryParse($testPlan, [ref]$testPlanId)){}

$testConfigurationId = 0
if([int]::TryParse($testConfiguration, [ref]$testConfigurationId)){}

if($runTitleMemberExists)
{
   if([string]::Equals($testSelection, "testPlan"))
   {
     if($testSelectionMemberExists)
     {     
       Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle -TestSelection $testSelection -TestPlan $testPlanId -TestSuites $testSuites -TestConfig $testConfigurationId
     }
     else
     {
       throw ("Update the build agent to be able to run tests from test plan.")
     }
   }
   else
   {
       Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle
   }
}
else
{
   if(!([string]::IsNullOrWhiteSpace($testRunTitle)))
   {
       Write-Warning "Update the build agent to be able to customize your test run title."
   }
   if([string]::Equals($testSelection, "testPlan"))
   {
     if($testSelectionMemberExists)
     {
        Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestSelection $testSelection -TestPlan $testPlanId -TestSuites $testSuites -TestConfig $testConfigurationId
     }
     else
     {
        throw ("Update the build agent to be able to run tests from test plan.")
     }
   }    
   else
   {
        Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation
   }
} 

Write-Verbose "Leaving script RunDistributedTests.ps1"
