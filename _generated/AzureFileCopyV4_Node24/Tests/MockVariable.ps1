
$validInputSourcePath = Join-Path $env:windir "Source"
$validInputAzureBlobDestinationType = "AzureBlob"
$validInputAzureVmsDestinationType = "AzureVms"
$validInputStorageAccount = "validInputStorageAccount"
$validInputContainerName = "validContainerName"
$validInputBlobPrefix = "validBlobPrefix"
$validResourceGroupName = "validResourceGroupName"
$validInputVmsAdminUserName = "validInputVmsAdminUserName"
$validInputVmsAdminPassword = "validInputVmsAdminPassword"
$validSasToken = '?sv=2015-02-21&sr=c&sig=Ncs6hCfAhzwwWd19eP7ToJATsS3xS1laFfPmRwO90qY%3D&se=2016-01-04T18%3A13%3A12Z&sp=rwdl'

$validStorageKey  = "validsotrageKey"
$validAzCopyLocation = Join-Path $env:windir "AzCopyLocation"
$validInputTargetPath = Join-Path $env:windir "Target"

$failedStatus = "Failed"
$failedCopyLog = "Failed Copy Operation"
$failedCopyError = $failedCopyLog
$failedDeploymentResponseForCopy = @{"MachineName" = "vm0"; "Status" = $failedStatus; "DeploymentLog" = $failedCopyLog; "ServiceLog" = $null; "Error" = @{"Message" = $failedCopyError}}

$passedStatus = "Passed"
$successLog = "Success Logs"
$passedDeploymentResponseForCopy = @{"Status" = $passedStatus; "DeploymentLog" = $successLog; "ServiceLog" = $null; "Error" = $null}
$passedLatestDeploymentResponseForCopy = @{"Status" = $passedStatus; "DeploymentLog" = $successLog; "ServiceLog" = $null; "Error" = $null}

$guidingMessageForAzureFileCopy = "For more info please refer to https://aka.ms/azurefilecopyreadme"
$winrmHelpMsg = "To fix WinRM connection related issues, select the 'Enable Copy Prerequisites' option in the task. If set already, and the target Virtual Machines are backed by a Load balancer, ensure Inbound NAT rules are configured for target port (5986). Applicable only for ARM VMs."

$succeededStatus = "Succeeded"
$succeededCopyResponse = @{"Status" = $succeededStatus; "Log" = $null; "Error" = $null}

$assembly = New-Object System.Collections.Generic.List``1[System.Object]

$testJobs = New-Object System.Collections.Generic.List``1[System.Object]
$failedJob = @{"Id" = "1"; "Status" = "Completed"}
$passedJob = @{"Id" = "2"; "Status" = "Completed"}
$passedLatestJob = @{"Id" = "3"; "Status" = "Completed"}
$passedJob1 = @{"Id" = "1"; "Status" = "Completed"}

$jobFailedResponse = @{"Status" = $failedStatus; "DeploymentLog" = $failedCopyLog; "ServiceLog" = $null; "Error" = $null}
$jobPassedResponse = @{"Status" = $passedStatus; "DeploymentLog" = $successLog; "ServiceLog" = $null; "Error" = $null}
$jobPassedLatestResponse = @{"Status" = $passedStatus; "DeploymentLog" = $successLog; "ServiceLog" = $null; "Error" = $null}

$connectedServiceName = "DummyConnectedServiceName"

$invokeRemoteScriptFailedResponse = @{ExitCode = 1}
$invokeRemoteScriptPassedResponse = @{ExitCode = 0}
$invokeRemoteScriptOnePassOneFailResponse = @($invokeRemoteScriptFailedResponse, $invokeRemoteScriptPassedResponse)
$invokeRemoteScriptAllPassedResponse = @($invokeRemoteScriptPassedResponse, $invokeRemoteScriptPassedResponse)

$validBlobStorageEndpoint = "https://validInputStorageAccount.blob.core.windows.net"

$spnEndpoint=@{}
$spnAuth=@{}

$spnEndpoint.Scheme='ServicePrincipal'
$spnEndpoint.Auth =$spnEndpoint