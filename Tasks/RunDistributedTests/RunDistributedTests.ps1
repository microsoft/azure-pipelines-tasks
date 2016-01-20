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
    [string]$testConfiguration,
    [string]$runSettingsFilePreview,
    [string]$codeCoverageEnabledPreview,
    [string]$overrideRunParamsPreview

)

Function CmdletHasMember($memberName) {
    $cmdletParameter = (gcm Invoke-RunDistributedTests).Parameters.Keys.Contains($memberName) 
    return $cmdletParameter
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
$checkTaCompatScriptLocation = Join-Path -Path $currentDirectory -ChildPath "CheckTestAgentCompat.ps1"
Write-Verbose "UnregisterTestAgent script Path  = $unRegisterTestAgentLocation"

Write-Verbose "Calling Invoke-RunDistributedTests"

$checkTestAgentCompatScriptLocationExists  = CmdletHasMember "CheckTestAgentCompatScriptLocation"

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
  
if($checkTestAgentCompatScriptLocationExists)
{     
    if(![string]::IsNullOrWhiteSpace($testPlan))  
    {
        $testSelection = "testPlan"
    }
    
    Write-Verbose "Invoking Run Distributed Tests with Register Environment support"
    
    Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFilePreview -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabledPreview -TestRunParams $overrideRunParamsPreview -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle -TestSelection $testSelection -TestPlan $testPlanId -TestSuites $testSuites -TestConfig $testConfigurationId -TaskContext $distributedTaskContext -CheckTestAgentCompatScriptLocation $checkTaCompatScriptLocation
}
else
{
    if(![string]::IsNullOrWhiteSpace($testPlan)) 
    {
        throw ("Update the build agent to be able to run tests from test plan.")
    }
    
    Write-Verbose "Invoking Run Distributed Tests with Machine Group Config"
    
    Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle
}
        
Write-Verbose "Leaving script RunDistributedTests.ps1"