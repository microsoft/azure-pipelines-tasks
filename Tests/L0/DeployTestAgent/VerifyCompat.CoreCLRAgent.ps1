[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

$connection = 'some connection'
$distributedTaskContext = 'Some distributed task context'
Register-Mock Get-VssConnection { $connection } -TaskContext $distributedTaskContext
Register-Mock Get-ServiceEndPoint { $vssEndPoint } -Context $distributedTaskContext -Name "SystemVssConnection"
Register-Mock Get-PersonalAccessToken { 'Some token' }
Register-Mock CmdletHasMember { $false }
Register-Mock Invoke-DeployTestAgent
Register-Mock Register-Environment { $true }

$input = @{
    'testMachineGroup' = 'testMachineGroup'
    'adminUserName' = 'adminUserName' 
    'adminPassword' = 'adminPassword' 
    'winRmProtocol' = 'winRmProtocol' 
    'testCertificate' = 'true'
    'resourceFilteringMethod' = 'resourceFilteringMethod'
    'testMachines' = 'testMachines'
    'runAsProcess' = 'runAsProcess'
    'machineUserName' = 'machineUserName'
    'machinePassword' = 'machinePassword'
    'agentLocation' = 'agentLocation'
    'updateTestAgent' = 'updateTestAgent'
    'isDataCollectionOnly' = 'isDataCollectionOnly'
}
& $PSScriptRoot\..\..\..\Tasks\DeployVisualStudioTestAgent\DeployTestAgent.ps1 @input

Assert-WasCalled Register-Environment -ParametersEvaluator {
    $EnvironmentName -eq 'testMachineGroup' -and
    $EnvironmentSpecification -eq 'testMachineGroup' -and
    $UserName -eq 'adminUserName' -and
    $Password -eq 'adminPassword' -and
    $TestCertificate -eq $true -and
    $Connection -eq 'some connection' -and
    $TaskContext -eq 'Some distributed task context' -and
    $WinRmProtocol -eq 'winRmProtocol' -and
    $ResourceFilter -eq 'testMachines'
}
Assert-WasCalled Get-VssConnection -Times 1
Assert-WasCalled Get-ServiceEndPoint -Times 1
Assert-WasCalled Get-PersonalAccessToken -Times 1
Assert-WasCalled CmdletHasMember -Times 1
Assert-WasCalled Invoke-DeployTestAgent -Times 1