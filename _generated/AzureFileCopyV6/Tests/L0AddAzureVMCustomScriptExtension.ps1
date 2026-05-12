[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

Register-Mock Write-Telemetry { }
Register-Mock Get-TargetUriFromFwdLink { "http://externalFile" }

# Test 1 "Should throw Resource group name is null"
Assert-Throws {
    Add-AzureVMCustomScriptExtension -resourceGroupName $null -vmName $vm0Name -dnsName $azurevmFqdn -location $location -connectedServiceName $connectedServiceName
} -MessagePattern "AFC_CopyPrereqsFailed *"


# Test 2 "Should throw when VM name is null"
Assert-Throws {
    Add-AzureVMCustomScriptExtension -resourceGroupName $validRG -vmName $null -dnsName $azurevmFqdn -location $location -connectedServiceName $connectedServiceName
} -MessagePattern "AFC_CopyPrereqsFailed *"

# Test 3 "should throw when VM name is invalid"
Register-Mock Get-Endpoint {}
Assert-Throws {
    Add-AzureVMCustomScriptExtension -resourceGroupName $validRG -vmName $invalidMachineName -dnsName $azurevmFqdn -location $location -connectedServiceName $connectedServiceName
} -MessagePattern "AFC_CopyPrereqsFailed AFC_UnableToSetCustomScriptExtension *"

# Test 4 "Should fail to provision winrm custom script extension and remove the failed extension"
$extensionName="WinRMCustomScriptExtension"
Register-Mock Set-AzureMachineCustomScriptExtension {
    return Set-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName -fileUri $configWinRMScriptFile, $makeCertFile  -run $invalidCustomScriptName -argument $dnsName -location $location 
} -ParametersEvaluator { $run -eq $scriptToRun }

Assert-Throws {
    Add-AzureVMCustomScriptExtension -resourceGroupName $validRG -vmName $vm0Name -dnsName $azurevmFqdn -location $location -connectedServiceName $connectedServiceName
} -MessagePattern "AFC_CopyPrereqsFailed *"

Assert-AreEqual 0 $vmInstanceViews[$vm0Name]["Extensions"].Count

# Test 5 "Should fail to deploy winrm custom script extension and remove the failed extension"
$extensionName="WinRMCustomScriptExtension"
Unregister-Mock Set-AzureMachineCustomScriptExtension
Register-Mock Set-AzureMachineCustomScriptExtension {
    return Set-AzureMachineCustomScriptExtension -resourceGroupName $resourceGroupName -vmName $vmName -name $extensionName -fileUri $configWinRMScriptFile, $makeCertFile  -run $invalidCustomScriptName -argument $dnsName -location $location
} -ParametersEvaluator { $run -eq $scriptToRun }        

Assert-Throws {
    Add-AzureVMCustomScriptExtension -resourceGroupName $validRG -vmName $vm0Name -dnsName $azurevmFqdn -location $location -connectedServiceName $connectedServiceName
} -MessagePattern "AFC_CopyPrereqsFailed *"

Assert-AreEqual 0 $vmInstanceViews[$vm0Name]["Extensions"].Count

# Test 6 "Should configure winrm successfully on target azure vm for valid Input"
Unregister-Mock Set-AzureMachineCustomScriptExtension
Add-AzureVMCustomScriptExtension -resourceGroupName $validRG -vmName $vm0Name -dnsName $azurevmFqdn -location $location -connectedServiceName $connectedServiceName
$tempStatus = Get-AzureMachineStatus -resourceGroupName $validRG -name $vm0Name
$tempStatus.Extensions.Statuses.DisplayStatus.Contains("Provisioning succeeded");

# Test 7 "Should skip configuring winrm on target azure vm"
Register-Mock Set-AzureMachineCustomScriptExtension { return $null }
Register-Mock Is-WinRMCustomScriptExtensionExists { return $true }
Add-AzureVMCustomScriptExtension -resourceGroupName $validRG -vmName $vm0Name -dnsName $azurevmFqdn -location $location -connectedServiceName $connectedServiceName

Assert-WasCalled Set-AzureMachineCustomScriptExtension  -Times 0

#Clean the extension
$vmInstanceViews[$vm0Name]["Extensions"]=@()