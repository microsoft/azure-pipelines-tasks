[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

$distributedTaskContext = 'Some distributed task context'
Register-Mock Get-VssConnection { $connection } -TaskContext $distributedTaskContext
Register-Mock CmdletHasMember { $true } -memberName "TaskContext"
Register-Mock Invoke-RunDistributedTests { $true } -- -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle -TestSelection $testSelection -TestPlan $testPlanId -TestSuites $testSuites -TestConfig $testConfigurationId -TaskContext $distributedTaskContext

$input = @{
    'testMachineGroup' = 'testMachineGroup'
    'dropLocation' = 'dropLocation'
    'sourcefilters' = 'sourcefilters'
    'testFilterCriteria' = 'testFilterCriteria'
    'testRunTitle' = 'testRunTitle'
    'platform' = 'platform'
    'configuration' = 'configuration'
    'runSettingsFile' = 'runSettingsFile'
    'codeCoverageEnabled' = 'codeCoverageEnabled'
    'overrideRunParams' = 'overrideRunParams'
    'testConfigurations' = 'testConfigurations'
    'autMachineGroup' = 'autMachineGroup'
    'testSelection' = ''
    'testPlan' = ''
    'testSuite' = ''
    'testConfiguration' = ''
}
& $PSScriptRoot\..\..\..\Tasks\RunVisualStudioTestsusingTestAgent\RunDistributedTests.ps1 @input


Assert-WasCalled Get-VssConnection -Times 1
Assert-WasCalled CmdletHasMember -Times 3
Assert-WasCalled Invoke-RunDistributedTests -Times 1