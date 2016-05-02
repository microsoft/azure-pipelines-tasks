[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

$distributedTaskContext = 'Some distributed task context'
Register-Mock Get-VssConnection { $connection } -TaskContext $distributedTaskContext
Register-Mock Get-ServiceEndPoint { $vssEndPoint } -Context $distributedTaskContext -Name "SystemVssConnection"
Register-Mock Get-PersonalAccessToken { 'Some token' }
Register-Mock CmdletHasMember { $true }
Register-Mock Invoke-DeployTestAgent
Register-Mock Register-Environment {'environment'}

$input = @{
    'testMachineGroup' = 'testMachineGroup'
    'adminUserName' = 'adminUserName' 
    'adminPassword' = 'adminPassword' 
    'winRmProtocol' = 'winRmProtocol' 
    'testCertificate' = 'testCertificate'
    'resourceFilteringMethod' = 'resourceFilteringMethod'
    'testMachines' = 'testMachines'
    'runAsProcess' = 'true'
    'machineUserName' = 'machineUserName'
    'machinePassword' = 'machinePassword'
    'agentLocation' = 'agentLocation'
    'updateTestAgent' = 'updateTestAgent'
    'isDataCollectionOnly' = 'isDataCollectionOnly'
}
& $PSScriptRoot\..\..\..\Tasks\DeployVisualStudioTestAgent\DeployTestAgent.ps1 @input

Assert-WasCalled Invoke-DeployTestAgent -ArgumentsEvaluator {
$args.Length -eq 36
}

Assert-WasCalled Invoke-DeployTestAgent -ParametersEvaluator {
	$TaskContext -eq $distributedTaskContext -and
	$MachineEnvironment -eq 'environment' -and
	$UserName -eq 'machineUserName' -and
	$Password -eq 'machinePassword' -and
	$MachineNames -eq 'testMachineGroup' -and
	$RunAsProcess -eq 'true' -and
	$LogonAutomatically -eq 'true' -and
	$DisableScreenSaver -eq 'true' -and
	$AgentLocation -eq 'agentLocation' -and
	$UpdateTestAgent -eq 'updateTestAgent' -and
	$InstallAgentScriptLocation -like '*TestAgentInstall.ps1' -and
	$ConfigureTestAgentScriptLocation -like '*TestAgentConfiguration.ps1' -and
	$downloadTestAgentScriptLocation -like '*DownloadTestAgent.ps1' -and
	$Connection -eq $connection -and
	$PersonalAccessToken -eq 'Some token' -and
	$DataCollectionOnly -eq 'isDataCollectionOnly' -and
	$VerifyTestMachinesAreInUseScriptLocation -like '*VerifyTestMachinesAreInUse.ps1' -and
	$CheckAgentInstallationScriptLocation -like '*CheckTestAgentInstallation.ps1'
    }
