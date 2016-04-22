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
    [string]$customSlicingEnabled

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

Write-Host "##vso[task.logissue type=warning;TaskName=DTA]"

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

$checkTestAgentCompatScriptLocationMemberExists  = CmdletHasMember "CheckTestAgentCompatScriptLocation"
$checkCustomSlicingEnabledMemberExists  = CmdletHasMember "CustomSlicingEnabled"
$taskContextMemberExists  = CmdletHasMember "TaskContext"

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

$customSlicingEnabledFlag = $false
if([bool]::TryParse($customSlicingEnabled, [ref]$customSlicingEnabledFlag)){}
 
 
if([string]::Equals($testSelection, "testPlan")) 
{
    if($checkCustomSlicingEnabledMemberExists)
    {
        try
        {	
            Write-Verbose "Invoking Run Distributed Tests with Register Environment support"
    
            Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle -TestSelection $testSelection -TestPlan $testPlanId -TestSuites $testSuites -TestConfig $testConfigurationId -TaskContext $distributedTaskContext -CheckTestAgentCompatScriptLocation $checkTaCompatScriptLocation -CustomSlicingEnabled $customSlicingEnabledFlag
	    }
        catch
        {
            Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=DTA]"
            throw
        }
    }
    elseif($checkTestAgentCompatScriptLocationMemberExists)
    {
        if($customSlicingEnabledFlag)
        {
            Write-Warning "Update the build agent to run tests with uniform distribution. If you are using hosted agent there are chances that it is still not updated, so retry using your own agent."
        }
        try
        {	
            if($taskContextMemberExists)
            {
                Write-Verbose "Invoking Run Distributed Tests with Register Environment support"
    
                Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle -TestSelection $testSelection -TestPlan $testPlanId -TestSuites $testSuites -TestConfig $testConfigurationId -TaskContext $distributedTaskContext -CheckTestAgentCompatScriptLocation $checkTaCompatScriptLocation
            }
            else
            {
                Write-Verbose "Invoking Run Distributed Tests with Machine Group Confg"
            
                Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFilePreview -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabledPreview -TestRunParams $overrideRunParamsPreview -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle -TestSelection $testSelection -TestPlan $testPlanId -TestSuites $testSuites -TestConfig $testConfigurationId -CheckTestAgentCompatScriptLocation $checkTaCompatScriptLocation
            }  
	    }
        catch
        {
            Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=DTA]"
            throw
        }
    }
    else
    {
        throw (Get-LocalizedString -Key "Update the build agent to run tests from test plan. If you are using hosted agent there are chances that it is still not updated, so retry using your own agent.")
    }
}
else
{
    if($checkCustomSlicingEnabledMemberExists)
    {
        try
        {	
            Write-Verbose "Invoking Run Distributed Tests with Register Environment support"
        
            Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle -TaskContext $distributedTaskContext -CustomSlicingEnabled $customSlicingEnabledFlag
	    }
        catch
        {
            Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=DTA]"
            throw
        }
    }
	else 
	{
        if($customSlicingEnabledFlag)
        {
            Write-Warning "Update the build agent to run tests with uniform distribution. If you are using hosted agent there are chances that it is still not updated, so retry using your own agent."
        }
        try
        {
            if($taskContextMemberExists)
            {
                Write-Verbose "Invoking Run Distributed Tests with Register Environment support"
        
                Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle -TaskContext $distributedTaskContext
            }
            else
            {
                Write-Verbose "Invoking Run Distributed Tests with Machng Group Confg"
        
                Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle
            }
        }
        catch
        {
            Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=DTA]"
            throw
        }
    }
}