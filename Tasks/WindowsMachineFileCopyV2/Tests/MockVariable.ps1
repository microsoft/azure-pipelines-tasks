# Input Parameters
$validResourceFQDNKeyName = 'Microsoft-Vslabs-MG-Resource-FQDN'
$validResourceWinRMHttpPortKeyName = 'WinRM_Http'
$validResourceWinRMHttpsPortKeyName = 'WinRM_Https'
$validSkipCACheckKeyName = 'Microsoft-Vslabs-MG-SkipCACheck'

$validEnvironmentName = "Test"
$validEnvironmentNameWithNoVm = "validEnvironmentNameWithNoVm"
$validEnvironmentNameWithDuplicateResourceName = "validEnvironmentNameWithDuplicateVmName"
$invalidEnvironmentWithNoResource = "invalidEnvironmentWithNoResource"

$validMachineName1 = "Test1"
$validMachineName2 = "Test2"
$validMachineId1 = "18"
$validMachineId2 = "19"
$validMachineId1Duplicate = "23"
$emptyInputMachineName = ""
$validMachineNames = $validMachineName1 + ", " + $validMachineName2
$testPath = Join-Path $env:windir "Test"
$powershellScriptPath = Join-Path $testPath 'powershell.ps1' 
$validScriptPath = $powershellScriptPath
$validInitializationScriptPath = $powershellScriptPath
$assembly = New-Object System.Collections.Generic.List``1[System.Object]
$testJobs = New-Object System.Collections.Generic.List``1[System.Object]
$userName = "UserName"
$password = "Password"
$winRmProtocol = "HTTPS"

#Invalid Input Parameters
$invalidInputEnvironmentName = "Invalid"
$invalidEnvironmentNameForFailCopy = "CopyFail"
$invalidEnvironmentNameForFailDeploy = "DeployFail"
$invalidEnvironmentNameWithNoUsername = "UsernameFail"
$invalidEnvironmentNameForNoResourceProperty = "CopyFailWithNoResourceProperty"
$invalidAdditionalArgumentsWithSemicolon = "echo 123;start notepad.exe"
$invalidAdditionalArgumentsWithAmpersand = "echo 123&start notepad.exe"
$environmentWithSkipCASet = "envWithSkipCAEnabled"
$environmentWithSkipCANotSet = "envWithSkipCADisabled"
$envWithBothProtocalsNotSet = "envWithBothProtocalsNotSet"
$EnvironmentNameForFailedJob = "Test1, Test2"

$machineNamesForFailCopy = "Test3"
$machineNamesForFailDeploy = "Test4"
$machineNamesForNoResouceProperty = "Test5"
$invalidInputMachineNames = "Invalid1"

$machineIdForFailCopy = "20"
$machineIdForFailDeploy = "21"
$machineIdForNoResouceProperty = "22"

# Environment Properties
$environmentWinRMHttpPort = '5985'
$environmentWinRMHttpPortForDuplicateResource = '5987'
$environmentWinRMHttpsPort = '5986'
$environmentUsername = "fareast\test"
$environmentPassword = "Password~1"

# Environment / Resource operations
$environmentOperationId = [guid]::NewGuid().ToString()
$operationIdForResource1 = [guid]::NewGuid().ToString()
$operationIdForResource2 = [guid]::NewGuid().ToString()
$operationIdForResource3 = [guid]::NewGuid().ToString()
$operationIdForResource4 = [guid]::NewGuid().ToString()

# Response Status
$FailedStatus = "Failed"
$PassedStatus = "Passed"

# Response Logs
$SuccessLog = "Success Logs"
$FailedLog = "Failed Logs"
$FailedCopyLog = "Failed Copy Operation."
$FailedDeployLog = "Failed Deployment Operation."


# Response Error
$FailedError = "Operation Failed"
$FailedCopyError = $FailedCopyLog
$FailedDeployError = $FailedDeployLog

# Resources 
$emptyResourceList = @{}
$validResource1 = @{"Id" = $validMachineId1; "Name" = $validMachineName1; "Type" = $null; "Username" = $environmentUsername; "Password" = $environmentPassword; "PropertyBag" = @{"Bag" = @{ "Microsoft-Vslabs-MG-Resource-FQDN" = @{"IsSecure" = $false; "Data" = $validMachineName1}; "Username" = @{"IsSecure" = $false; "Data" = $environmentUsername}; "Password" = @{"IsSecure" = $false; "Data" = $environmentPassword}}}}
$validResource2 = @{"Id" = $validMachineId2; "Name" = $validMachineName2; "Type" = $null; "Username" = $environmentUsername; "Password" = $environmentPassword; "PropertyBag" = @{"Bag" = @{ "Microsoft-Vslabs-MG-Resource-FQDN" = @{"IsSecure" = $false; "Data" = $validMachineName1}; "Username" = @{"IsSecure" = $false; "Data" = $environmentUsername}; "Password" = @{"IsSecure" = $false; "Data" = $environmentPassword}}}}
$resourceFailForCopy = @{"Id" = $machineIdForFailCopy; "Name" = $machineNamesForFailCopy; "Type" = $null; "Username" = $environmentUsername; "Password" = $environmentPassword; "PropertyBag" = @{"Bag" = @{ "Microsoft-Vslabs-MG-Resource-FQDN" = @{"IsSecure" = $false; "Data" = $validMachineName1}; "Username" = @{"IsSecure" = $false; "Data" = $environmentUsername}; "Password" = @{"IsSecure" = $false; "Data" = $environmentPassword}}}}
$resourceFailForDeploy = @{"Id" = $machineIdForFailDeploy; "Name" = $machineNamesForFailDeploy; "Type" = $null; "Username" = $environmentUsername; "Password" = $environmentPassword; "PropertyBag" = @{"Bag" = @{ "Microsoft-Vslabs-MG-Resource-FQDN" = @{"IsSecure" = $false; "Data" = $validMachineName1}; "Username" = @{"IsSecure" = $false; "Data" = $environmentUsername}; "Password" = @{"IsSecure" = $false; "Data" = $environmentPassword}}}}
$resourceFailForNoProperty = @{"Id" = $machineIdForNoResouceProperty; "Name" = $machineNamesForNoResouceProperty; "Type" = $null; "Username" = $environmentUsername; "Password" = $environmentPassword; "PropertyBag" = @{"Bag" = @{ "Microsoft-Vslabs-MG-Resource-FQDN" = @{"IsSecure" = $false; "Data" = $validMachineName1}; "Username" = @{"IsSecure" = $false; "Data" = $environmentUsername}; "Password" = @{"IsSecure" = $false; "Data" = $environmentPassword}}}}
$validResource1Duplicate = @{"Id" = $validMachineId1Duplicate; "Name" = $validMachineName1; "Type" = $null; "Username" = $environmentUsername; "Password" = $environmentPassword; "PropertyBag" = @{"Bag" = @{ "Microsoft-Vslabs-MG-Resource-FQDN" = @{"IsSecure" = $false; "Data" = $validMachineName1}; "Username" = @{"IsSecure" = $false; "Data" = $environmentUsername}; "Password" = @{"IsSecure" = $false; "Data" = $environmentPassword}}}}

$validResources = New-Object 'System.Collections.Generic.List[System.Object]'
$validResources.Add($validResource1)
$validResources.Add($validResource2)

$validResourcesWithDuplicateResourceName = New-Object 'System.Collections.Generic.List[System.Object]'
$validResourcesWithDuplicateResourceName.Add($validResource1)
$validResourcesWithDuplicateResourceName.Add($validResource1Duplicate)

# Resource Property Key Names 
$resourceFQDNKeyName = 'Microsoft-Vslabs-MG-Resource-FQDN'
$resourceWinRMHttpPortKeyName = 'WinRM_Http'
$resourceWinRMHttpsPortKeyName = 'WinRM_Https'
$skipCACheckKeyName = 'Microsoft-Vslabs-MG-SkipCACheck'

#Deployment Responses
$passResponseForResource1 = @{"MachineName" = $validMachineName1; "Status" = $PassedStatus; "DeploymentLog" = $SuccessLog; "ServiceLog" = $null; "Error" = $null}
$passResponseForResource2 = @{"MachineName" = $validMachineName2; "Status" = $PassedStatus; "DeploymentLog" = $SuccessLog; "ServiceLog" = $null; "Error" = $null}
$failedResponseForCopy = @{"MachineName" = $machineNamesForFailCopy; "Status" = $FailedStatus; "DeploymentLog" = $FailedCopyLog; "ServiceLog" = $null; "Error" = @{"Message" = $FailedCopyError}}
$failedResponseForDeploy = @{"MachineName" = $machineNamesForFailDeploy; "Status" = $FailedStatus; "DeploymentLog" = $FailedDeployLog; "ServiceLog" = $null; "Error" = @{"Message" = $FailedDeployError}}
$JobPassResponse = @{"Status" = $PassedStatus; "DeploymentLog" = $SuccessLog; "ServiceLog" = $null; "Error" = $null}
$JobFailResponseForDeploy = @{"Status" = $FailedStatus; "DeploymentLog" = $FailedDeployLog; "ServiceLog" = $null; "Error" = $null}
$JobFailResponseForCopy = @{"Status" = $FailedStatus; "DeploymentLog" = $FailedCopyLog; "ServiceLog" = $null; "Error" = $null}

#Jobs
$Job1 = @{"Id" = "1"; "Status" = "Completed"}
$Job2 = @{"Id" = "2"; "Status" = "Completed"}
$Job3 = @{"Id" = "3"; "Status" = "Completed"}

#SkipCA Key and value
$doSkipCACheckOption = '-SkipCACheck'

#WindowsFileCopy Constants
$validSourcePackage = $testPath
$validApplicationPath = $testPath
$invalidSourcePath = "Invalid"
$invalidTargetPath = "`$env:abc\123"

#path to WindowsMachineFileCopy.ps1
$copyFilesToMachinesPath = "$PSScriptRoot\..\WindowsMachineFileCopy.ps1"