[cmdletbinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

$distributedTaskContext = 'Some distributed task context'
Register-Mock Get-VssConnection { $connection } -TaskContext $distributedTaskContext
Register-Mock Get-ServiceEndPoint { $vssEndPoint } -Context $distributedTaskContext -Name "SystemVssConnection"
Register-Mock Get-PersonalAccessToken { $null }
Register-Mock Invoke-DeployTestAgent
Register-Mock Get-LocalizedString { $true } -- -Key "Unable to generate Personal Access Token for the user. Contact Project Collection Administrator"

$input = @{
    'testMachineGroup' = 'testMachineGroup'
    'adminUserName' = 'adminUserName' 
    'adminPassword' = 'adminPassword' 
    'winRmProtocol' = 'winRmProtocol' 
    'testCertificate' = 'testCertificate'
    'resourceFilteringMethod' = 'resourceFilteringMethod'
    'testMachines' = 'testMachines'
    'runAsProcess' = 'runAsProcess'
    'machineUserName' = 'machineUserName'
    'machinePassword' = 'machinePassword'
    'agentLocation' = 'agentLocation'
    'updateTestAgent' = 'updateTestAgent'
    'isDataCollectionOnly' = 'isDataCollectionOnly'
}

Assert-Throws {
    & $PSScriptRoot\..\..\..\Tasks\DeployVisualStudioTestAgent\DeployTestAgent.ps1 @input
}

Assert-WasCalled Get-VssConnection -Times 1
Assert-WasCalled Get-ServiceEndPoint -Times 1
Assert-WasCalled Get-PersonalAccessToken -Times 1
Assert-WasCalled Get-LocalizedString -Times 1
Assert-WasCalled Invoke-DeployTestAgent -Times 0