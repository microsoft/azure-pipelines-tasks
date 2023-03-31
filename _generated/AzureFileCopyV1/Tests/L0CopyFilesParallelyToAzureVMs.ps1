[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\MockHelper.ps1

$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$vmName = "myVM0"
$vmfqdn = "lbipac2b71e2680c44fd987d.westus.cloudapp.azure.com"
$vmWinRMHttpsPort1 = '40001'
$vmWinRMHttpsPort2 = '40003'
$vmWinRMHttpsPort3 = '40005'
$azureVMsProperties = Get-AzureVMResourcesProperties -resourceGroupName $validRG -connectionType 'ServicePrincipal' -resourceFilteringMethod 'tags'
$azureVMCredntials = Get-AzureVMsCredentials -vmsAdminUserName $validInputVmsAdminUserName -vmsAdminPassword $validInputVmsAdminPassword

Register-Mock Get-DeploymentModulePath { Write-Output (Join-Path $(Get-Location).Path "Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs") }

# Test 1 "Should throw if failed on one vm and passed on other vm" 

Register-Mock Copy-ToAzureMachines { return $failedDeploymentResponseForCopy } -ParametersEvaluator { $WinRMPort -eq $vmWinRMHttpsPort1 }
Register-Mock Copy-ToAzureMachines { return $passedDeploymentResponseForCopy } -ParametersEvaluator { $WinRMPort -eq $vmWinRMHttpsPort2 }
Register-Mock Copy-ToAzureMachines { return $passedLatestDeploymentResponseForCopy } -ParametersEvaluator { $WinRMPort -eq $vmWinRMHttpsPort3 }
Register-Mock Get-ChildItem { return $assembly }
Register-Mock Write-ResponseLogs { }        

Register-Mock Start-Job { $testJobs.Add($failedJob); return $failedJob} -ParametersEvaluator{$ArgumentList -contains $vmWinRMHttpsPort1 }
Register-Mock Start-Job { $testJobs.Add($passedJob); return $passedJob} -ParametersEvaluator{$ArgumentList -contains $vmWinRMHttpsPort2 }
Register-Mock Start-Job { $testJobs.Add($passedLatestJob); return $passedLatestJob} -ParametersEvaluator{$ArgumentList -contains $vmWinRMHttpsPort3 }
Register-Mock Get-Job { return $testJobs }

Register-Mock Start-Sleep { }

Register-Mock Receive-Job { return $jobFailedResponse } -ParametersEvaluator{$Id -eq $failedJob.Id}
Register-Mock Receive-Job { return $jobPassedResponse } -ParametersEvaluator{$Id -eq $passedJob.Id}
Register-Mock Receive-Job { return $jobPassedLatestResponse } -ParametersEvaluator{$Id -eq $passedLatestJob.Id}
Register-Mock Remove-Job { $testJobs.RemoveAt(0) }
Register-Mock Write-Telemetry { }

Assert-Throws {
    Copy-FilesParallellyToAzureVMs -storageAccountName $validInputStorageAccount -containerName $validInputContainerName -containerSasToken $validSasToken `
            -targetPath $validInputTargetPath -azCopyLocation $validAzCopyLocation -azureVMResourcesProperties $azureVMsProperties `
            -azureVMsCredentials $azureVMCredntials -cleanTargetBeforeCopy "false" -communicationProtocol '' -skipCACheckOption "false" -enableDetailedLoggingString "false" `
            -additionalArguments "" -connectionType 'ServicePrincipal'    
} -MessagePattern "AFC_ParallelCopyFailed*"

Assert-WasCalled Start-Job -Times 3
Assert-WasCalled Receive-Job -Times 3

# Test 2 "Should not throw if copy passed on both vms" 
Unregister-Mock Start-Job
Register-Mock Start-Job { $testJobs.Add($passedJob1); return $passedJob1} -ParametersEvaluator{$ArgumentList -contains $vmWinRMHttpsPort1 }
Register-Mock Start-Job { $testJobs.Add($passedJob); return $passedJob} -ParametersEvaluator{$ArgumentList -contains $vmWinRMHttpsPort2 }
Register-Mock Start-Job { $testJobs.Add($passedLatestJob); return $passedLatestJob} -ParametersEvaluator{$ArgumentList -contains $vmWinRMHttpsPort3 }

Unregister-Mock Copy-ToAzureMachines
Register-Mock Copy-ToAzureMachines { return $passedDeploymentResponseForCopy } 

Unregister-Mock Remove-Job
Register-Mock Remove-Job { $testJobs.RemoveAt(0) }

Unregister-Mock Receive-Job
Register-Mock Receive-Job { return $jobPassedResponse }
Copy-FilesParallellyToAzureVMs -storageAccountName $validInputStorageAccount -containerName $validInputContainerName -containerSasToken $validSasToken `
            -targetPath $validInputTargetPath -azCopyLocation $validAzCopyLocation -azureVMResourcesProperties $azureVMsProperties `
            -azureVMsCredentials $azureVMCredntials -cleanTargetBeforeCopy "false" -communicationProtocol '' -skipCACheckOption "false" -enableDetailedLoggingString "false" `
            -additionalArguments "" -connectionType 'ServicePrincipal'

Assert-WasCalled Start-Job -Times 3
Assert-WasCalled Receive-Job -Times 3