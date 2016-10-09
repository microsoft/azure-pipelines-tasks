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
    [string]$customSlicingEnabled,
    [string]$runOnlyImpactedTests,
    [string]$runAllTestsAfterXBuilds
)

Function CmdletHasMember($memberName) {
    $cmdletParameter = (gcm Invoke-RunDistributedTests).Parameters.Keys.Contains($memberName) 
    return $cmdletParameter
}

Function Get-PersonalAccessToken($vssEndPoint) {
    return $vssEndpoint.Authorization.Parameters.AccessToken
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
Write-Verbose "Run Only Impacted Tests = $runOnlyImpactedTests"
Write-Verbose "Run All tests After X Builds = $runAllTestsAfterXBuilds"


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
$IsTestImpactOnMemberExists  = CmdletHasMember "TestImpactEnabled"

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

$isTestImpactOnFlag = $false
if([bool]::TryParse($runOnlyImpactedTests, [ref]$isTestImpactOnFlag)){}

$reBaseValue = 0
if([int]::TryParse($runAllTestsAfterXBuilds, [ref]$reBaseValue)){}

# If the agent is new and test impact is on publish code changes
if($IsTestImpactOnMemberExists -and $isTestImpactOnFlag)
{    
    $releaseUri = Get-TaskVariable -Name 'release.releaseUri' # used to check if this is CD
    Write-Verbose "Getting the connection object"
    $connection = Get-VssConnection -TaskContext $distributedTaskContext

    Write-Verbose "Getting Personal Access Token for the Run"
    $vssEndPoint = Get-ServiceEndPoint -Context $distributedTaskContext -Name "SystemVssConnection"
    $personalAccessToken = Get-PersonalAccessToken $vssEndpoint


    # Get current directory.
    $currentDirectory = Convert-Path .
    $testSelectorToolPath = Join-Path -Path $currentDirectory -ChildPath "TestSelector\TestSelector.exe"
    $projectCollectionUrl = Get-TaskVariable -Name 'System.TeamFoundationCollectionUri'
    $projectId = Get-TaskVariable -Name 'System.TeamProject'
    $tiaRebaseLimit = $reBaseValue
    $isPrFlow = Get-TaskVariable -Name 'tia.isPrFlow'
    $isPrFlowBool = $false
    $tiaBaseLineDefinitionRunIdFile = [System.IO.Path]::GetTempFileName()

    if([string]::IsNullOrEmpty($releaseUri))
    {
        $context = "CI"
        $definitionRunId = Get-TaskVariable -Name 'Build.BuildId'
        $definitionId = Get-TaskVariable -Name 'System.DefinitionId'
        $sourcesDir = Get-TaskVariable -Name 'build.sourcesdirectory'
    }
    else 
    {
        $context = "CD"
        $definitionRunId = Get-TaskVariable -Name 'Release.ReleaseId'
        $definitionId = Get-TaskVariable -Name 'release.DefinitionId'
        $sourcesDir = ''
    }
    
    $testSelectorSuceeded = $true

    $args[0] = "PublishCodeChanges"
    $args[1] = "/TfsTeamProjectCollection:" + $projectCollectionUrl
    $args[2] = "/ProjectId:" + $projectId
    $args[3] = "/buildid:" + $definitionRunId
    $args[4] = "/Definitionid:" + $definitionId
    $args[5] = "/token:" + $personalAccessToken
    $args[6] = "/SourcesDir:" + $sourcesDir
    $args[7] = "/RebaseLimit:" + $reBaseValue
    $args[8] = "/Context:" + $context
    $args[9] = "/BaseLineFile:" + $tiaBaseLineDefinitionRunIdFile

    if([bool]::TryParse($isPrFlow, [ref]$isPrFlowBool))
    {
        $args[10] = "/IsPrFlow:" + $isPrFlowBool
    }
    else 
    {
        $args[10] = "/IsPrFlow:false"
    }

    # invoke TestSelector.exe
    try 
    {
        Invoke-Command -ScriptBlock $testSelectorToolPath -ArgumentList $args[0], $args[1], $args[2], $args[3], $args[4], $args[5], $args[6], $args[7], $args[8], $args[9], $args[10]
    }
    catch
    {
        $testSelectorSuceeded = $false
        Write-Warning -Verbose "TestSelector failed."
    }
}

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

if (([string]::Compare([io.path]::GetExtension($runSettingsFile), ".tmp", $True) -eq 0))
{
    Write-Host "Removing temp settings file"
    Remove-Item $runSettingsFile
}