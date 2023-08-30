############## Constants ##########
$invalidParam = "invalidParam"
$validRG = "AzureFileCopyTaskPlatformTestDoNotDelete"
$rgWithNoVM = "AzureFIleCopyPTRGNoVMDoNotDelete"
$rgNameWithSecurityGroup = "AzureFIleCopyPTRGWithSGDoNotDelete"
$validStorage = "azurefilecopyptsstore"
$validStorageKey = "validStorageKey"
$storageAccounts = @{}
$storageAccounts.Add($validStorage, $validStorageKey)
$validClassicStorage = "ptclassicstoredontdelete"
$validClassicStorageKey = "validClassicStorageKey"
$storageAccounts.Add($validClassicStorage, $validClassicStorageKey)

$storageAccountsRG = @{}
$storageAccountsRG.Add($validStorage, $validRG)
$storageAccountsRG.Add($validClassicStorage, $validClassicStorageKey)

$storageAccountsContext = @{}
$storageAccountContext = @{}
$storageAccountContext.StorageAccountName = $validStorage
$storageAccountsContext.Add($validStorage, $storageAccountContext)

$validSasToken = 'anyValidSaasToken'

$location = "West US"
$vm0Name = "myVM0"
$vm1Name = "mytestVM0"
$vm2Name = "mytestPTVM1"
$lbName = "myLB"
$classicvmfqdn = "taskplatformtesttwovm.cloudapp.net"
$rgWithNoClassicVms = "taskplatformtestnovm"
$rgWithClassicVMs = "taskplatformtesttwovm"
$classicvm0 = "vm0"
$classicvm1 = "VM1"
$azurevmFqdn = "azurefilecopyplatformtestsdns.westus.cloudapp.azure.com"
$winrmPort1 = "40001"
$winrmPort2 = "40003"
$winrmPort3 = "40005"
$classicWinrmPort1 = "5986"
$classicWinrmPort2 = "57148"
$classicWinrmPort3 = "57149"

# creating resourcegroups dictionary
$resourceGroups = @{}
$resourceGroup = @{}
$resourceGroup.ResourceGroupName = $validRG
$resourceGroup.Location = $location
$resourceGroups.Add($validRG, $resourceGroup)

$resourceGroup.ResourceGroupName = $rgWithNoVM
$resourceGroups.Add($rgWithNoVM, $resourceGroup)
$resourceGroup.ResourceGroupName = $rgWithNoClassicVms
$resourceGroups.Add($rgWithNoClassicVms, $resourceGroup)

$validActionResponse = @{"Status" = "Succeeded"}
$VMsStatus = @{$vm0Name = "Running"; $vm1Name = "Running";$vm2Name = "Running"}

$resourceGroups[$validRG].VMsDetails = $VMsStatus

$vmInstanceView = @{"Statuses" = @(@{"DisplayStatus" = "Provisioning succeeded"},@{"DisplayStatus" = "VM running"}); "Extensions" = @(); "VMAgent" = @{"ExtensionHandlers" = @()}}
$vmInstanceViews = @{$vm0Name = $vmInstanceView; $vm1Name = $vmInstanceView ; $vm2Name = $vmInstanceView}
$vmResources = @(@{"Id" = "Microsoft.Compute/virtualMachines/myVM0"; "Name" = $vm0Name; "Location" = $location; "Tags" = @{"role" = "Test"}}, @{"Id" = "Microsoft.Compute/virtualMachines/mytestVM0"; "Name" = $vm1Name; "Location" = $location; "Tags" = @{"role" = "mytest"}} , @{"Id" = "Microsoft.Compute/virtualMachines/mytestPTVM1"; "Name" = $vm2Name; "Location" = $location; "Tags" = @{"role" = "mytestPT"}})

$virtualMachine1 = @{"Id" = "Microsoft.Compute/virtualMachines/myVM0"}
$IpConfigurations1 = @(@{"Name" = "ipconfig1"; "Id" = "Microsoft.Network/networkInterfaces/nic0/ipConfigurations/ipconfig1"; "LoadBalancerInboundNatRules" = @(@{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/RDP-VM0"}, @{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/WINRM-VM0"})})
$networkInterface1 = @{"Name" = "nic0"; "VirtualMachine" = $virtualMachine1; "IpConfigurations" = $IpConfigurations1}

$virtualMachine2 = @{"Id" = "Microsoft.Compute/virtualMachines/mytestVM0"}
$IpConfigurations2 = @(@{"Name" = "ipconfig2"; "Id" = "Microsoft.Network/networkInterfaces/nicN0/ipConfigurations/ipconfig2"; "LoadBalancerInboundNatRules" = @(@{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/NRDP-VM0"}, @{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/NWINRM-VM0"})})
$networkInterface2 = @{"Name" = "nicN0"; "Id" = "Microsoft.Network/networkInterfaces/nicN0"; "VirtualMachine" = $virtualMachine2; "IpConfigurations" = $IpConfigurations2}

$virtualMachine3 = @{"Id" = "Microsoft.Compute/virtualMachines/mytestPTVM1"}
$IpConfigurations3 = @(@{"Name" = "ipconfig3"; "Id" = "Microsoft.Network/networkInterfaces/mytestptvm0456/ipConfigurations/ipconfig3"; "LoadBalancerInboundNatRules" = @(@{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/MRDP-VM0"}, @{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/MWINRM-VM0"})})
$networkInterface3 = @{"Name" = "mytestptvm0456"; "Id" = "Microsoft.Network/networkInterfaces/mytestptvm0456"; "VirtualMachine" = $virtualMachine3; "IpConfigurations" = $IpConfigurations3}

$networkInterfaceResources = @($networkInterface1, $networkInterface2,$networkInterface3)

$IpConfiguration3 =  @{"Id" = "Microsoft.Network/loadBalancers/myLB/frontendIPConfigurations/LoadBalancerFrontend"}
$publicIPAddressResources = @(@{"Name" = "myPublicIP"; "Id" = "Microsoft.Network/publicIPAddresses/myPublicIP"; "IpConfiguration" = $IpConfiguration3; "IpAddress" = "40.118.129.77"; "DnsSettings" = @{"Fqdn" = "lbipac2b71e2680c44fd987d.westus.cloudapp.azure.com"}},@{"Name" = "myTestPTVM0"; "Id" = "Microsoft.Network/publicIPAddresses/myTestPTVM0"; "IpConfiguration" = $IpConfiguration3; "IpAddress" = "13.91.111.214"; "DnsSettings" = @{"Fqdn" = "lbipeca3f178ce794301af12.westus.cloudapp.azure.com"}})

$inboundNatRules = @(@{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/RDP-VM0"}, @{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/RDP-VM1"}, @{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/WINRM-VM0"}, @{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/WINRM-VM1"}, @{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/NRDP-VM0"}, @{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/NRDP-VM1"}, @{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/NWINRM-VM0"}, @{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/NWINRM-VM1"},@{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/MRDP-VM0"}, @{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/MRDP-VM1"}, @{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/MWINRM-VM0"}, @{"Id" = "Microsoft.Network/loadBalancers/myLB/inboundNatRules/MWINRM-VM1"})
$frontEndIPConfigs = @(@{"Name" = "LoadBalancerFrontend"; "PublicIpAddress" = @{"Id" = "Microsoft.Network/publicIPAddresses/myPublicIP"}; "InboundNatRules" = $inboundNatRules})

$inboundRule1 = @{"Name" = "RDP-VM0"; "FrontendPort" = "50001"; "BackendPort" = "3389"; "BackendIPConfiguration" = @{"Id" = "Microsoft.Network/networkInterfaces/nic0/ipConfigurations/ipconfig1"}}
$inboundRule2 = @{"Name" = "RDP-VM1"; "FrontendPort" = "50002"; "BackendPort" = "3389"; "BackendIPConfiguration" = $null}
$inboundRule3 = @{"Name" = "WINRM-VM0"; "FrontendPort" = $winrmPort1; "BackendPort" = "5986"; "BackendIPConfiguration" = @{"Id" = "Microsoft.Network/networkInterfaces/nic0/ipConfigurations/ipconfig1"}}
$inboundRule4 = @{"Name" = "WINRM-VM1"; "FrontendPort" = "40002"; "BackendPort" = "5986"; "BackendIPConfiguration" = $null}
$inboundRule5 = @{"Name" = "NRDP-VM0"; "FrontendPort" = "50003"; "BackendPort" = "3389"; "BackendIPConfiguration" = @{"Id" = "Microsoft.Network/networkInterfaces/nicN0/ipConfigurations/ipconfig2"}}
$inboundRule6 = @{"Name" = "NRDP-VM1"; "FrontendPort" = "50004"; "BackendPort" = "3389"; "BackendIPConfiguration" = $null}
$inboundRule7 = @{"Name" = "NWINRM-VM0"; "FrontendPort" = "$winrmPort2"; "BackendPort" = "5986"; "BackendIPConfiguration" = @{"Id" = "Microsoft.Network/networkInterfaces/nicN0/ipConfigurations/ipconfig2"}}
$inboundRule8 = @{"Name" = "NWINRM-VM1"; "FrontendPort" = "40004"; "BackendPort" = "5986"; "BackendIPConfiguration" = $null}
$inboundRule9 = @{"Name" = "MRDP-VM0"; "FrontendPort" = "50005"; "BackendPort" = "3389"; "BackendIPConfiguration" = @{"Id" = "Microsoft.Network/networkInterfaces/mytestptvm0456/ipConfigurations/ipconfig3"}}
$inboundRule10 = @{"Name" = "MRDP-VM1"; "FrontendPort" = "50006"; "BackendPort" = "3389"; "BackendIPConfiguration" = $null}
$inboundRule11 = @{"Name" = "MWINRM-VM0"; "FrontendPort" = "$winrmPort3"; "BackendPort" = "5986"; "BackendIPConfiguration" = @{"Id" = "Microsoft.Network/networkInterfaces/mytestptvm0456/ipConfigurations/ipconfig3"}}
$inboundRule12 = @{"Name" = "MWINRM-VM1"; "FrontendPort" = "40006"; "BackendPort" = "5986"; "BackendIPConfiguration" = $null}
$inboundRules = @($inboundRule1, $inboundRule2, $inboundRule3, $inboundRule4, $inboundRule5, $inboundRule6, $inboundRule7, $inboundRule8,$inboundRule9,$inboundRule10,$inboundRule11,$inboundRule12)

$loadBalancerDetails = @{"frontEndIPConfigs" = $frontEndIPConfigs; "inboundRules" = $inboundRules}
$loadBalancerResources = @{$lbName = $loadBalancerDetails}

$azureResourceGroupDeploymentResponse = @{"networkInterfaceResources" = $networkInterfaceResources; "publicIPAddressResources" = $publicIPAddressResources; "loadBalancerResources" = $loadBalancerResources}

#creating one RG deployment to be used through out test
$resourceGroupDeployments = @{}
$resourceGroupVMs = @{}
$resourceGroupDeployments.Add($validRG, $azureResourceGroupDeploymentResponse)
$resourceGroupVMs.Add($validRG, $VMsStatus)

$cloudServices = @{}
$cloudServiceWithNoVM = @{"vms" = $null; "vmConnectionDetails" = $null}
$vmConnectionDetailsWithTwoVms = @{$classicvm0 = @{"Name" = $classicvm0; "fqdn" = $classicvmfqdn; "winRMHttpsPort" = $classicWinrmPort1}; $classicvm1 = @{"Name" = $classicvm1; "fqdn" = $classicvmfqdn; "winRMHttpsPort" = $classicWinrmPort2}}
$cloudServiceWithTwoVM = @{"vms" = @(@{"Name" = $classicvm0}, @{"Name" = $classicvm1}); "vmConnectionDetails" = $vmConnectionDetailsWithTwoVms}

$cloudServices.Add($rgWithNoClassicVms, $cloudServiceWithNoVM)
$cloudServices.Add($rgWithClassicVMs, $cloudServiceWithTwoVM)

#Extensions
$winRMcustomScripExtensionObject = @{}
$winRMcustomScripExtensionObject["ExtensionType"]="Microsoft.Compute.CustomScriptExtension"
$winRMcustomScripExtensionObject["Name"]="winrmcustomscriptextension"
$winRMcustomScripExtensionObject["TypeHandlerVersion"]="1.4"

$subStatus0 = @{}
$subStatus0["Code"]="ComponentStatus/StdOut/succeeded"
$subStatus0["DisplayStatus"]="Provisioning succeeded"
$subStatus0["Level"]="Info"
$subStatus0["Message"]="Succeeded\\n\\nDeleted 1 rule(s).\\nOk.\\n\\nOk.\\n"
$subStatus0["Time"]=$null


$subStatus1 = @{}
$subStatus1["Code"]="ComponentStatus/StdErr/succeeded"
$subStatus1["DisplayStatus"]="Provisioning succeeded"
$subStatus1["Level"]="Info"
$subStatus1["Message"]=""
$subStatus1["Time"]=$null

$substatuses = @()
$substatuses+=$subStatus0
$substatuses+=$subStatus1

$winRMcustomScripExtensionObject["SubStatuses"]=@()
$winRMcustomScripExtensionObject["SubStatuses"]+=$substatuses


$status0 = @{}
$status0["Code"]="ProvisioningState/succeeded"
$status0["DisplayStatus"]="Provisioning succeeded"
$status0["Level"]="Info"
$status0["Message"]="Finished executing command"
$status0["Time"]=$null

$statuses = @()
$statuses += $status0

$winRMcustomScripExtensionObject["Statuses"]=@()
$winRMcustomScripExtensionObject["Statuses"]+=$statuses

$extensions = @()
$extensions += $winRMcustomScripExtensionObject

$getCustomScriptExtensionResponse = @{"Status"="Succeeded"}
$setCustomScriptExtensionResponse = @{"Status"="Succeeded"}
$rgustomScriptExtensionResponse = @{"Status"="Succeeded"}
$winrmCustomScriptExtension="WinRmCustomScriptExtension"
$invalidCustomScriptName = "InvalidConfigureWinRM.ps1"

$securityGroups = New-Object System.Collections.Generic.List[System.Object]
$securityRules = New-Object System.Collections.Generic.List[System.Object]

$validSecurityGroupProps = @{"Name"="VMWithSG";"SecurityRules"=$securityRules}
$validSecurityGroup = New-Object PSObject -Property $validSecurityGroupProps
$securityGroups.Add($validSecurityGroup)


$securityGroupsRecommended = New-Object System.Collections.Generic.List[System.Object]
$securityRulesRecommended = New-Object System.Collections.Generic.List[System.Object]

$validSecurityGroupPropsRecommended = @{"Name"="VMWithSGRecPS";"SecurityRules"=$securityRulesRecommended}
$validSecurityGroupRecommended = New-Object PSObject -Property $validSecurityGroupPropsRecommended
$securityGroupsRecommended.Add($validSecurityGroupRecommended)

$securityGroupsLatest = New-Object System.Collections.Generic.List[System.Object]
$securityRulesLatest = New-Object System.Collections.Generic.List[System.Object]

$validSecurityGroupPropsLatest = @{"Name"="VMWithSGHighPS";"SecurityRules"=$securityRulesLatest}
$validSecurityGroupLatest = New-Object PSObject -Property $validSecurityGroupPropsLatest
$securityGroupsLatest.Add($validSecurityGroupLatest)

$securedMockPassword = New-Object -TypeName System.Security.SecureString

$vmIdWhichHasSecurityGroupPrevious = "/subscriptions/c94bda7a-0577-4374-9c53-0e46a9fb0f70/resourceGroups/AzureFIleCopyPTRGWithSGDoNotDelete/providers/Microsoft.Compute/virtualMachines/VMWithSG"
$vmIdWhichHasSecurityGroupRecommended = "/subscriptions/c94bda7a-0577-4374-9c53-0e46a9fb0f70/resourceGroups/AzureFIleCopyPTRGWithSGDoNotDelete/providers/Microsoft.Compute/virtualMachines/VMWithSGRecPS"
$vmIdWhichHasSecurityGroupLatest = "/subscriptions/c94bda7a-0577-4374-9c53-0e46a9fb0f70/resourceGroups/AzureFIleCopyPTRGWithSGDoNotDelete/providers/Microsoft.Compute/virtualMachines/VMWithSGHighPS"
$vmIdWhichHasNoSecurityGroup = "/subscriptions/c94bda7a-0577-4374-9c53-0e46a9fb0f70/resourceGroups/AzureFileCopyTaskPlatformTestDoNotDelete/providers/Microsoft.Compute/virtualMachines/mytestVM0"
$duplicateRuleName = "VSO-Custom-WinRM-Https-Port-Deplicate"

#Create Mock Object type for  Hyak.Common.CloudException
$Source = @"
    using System;
namespace Hyak.Common {
    public class CloudException : Exception {
    }
}
"@ 
Add-Type -TypeDefinition $Source -Language CSharp

function Get-AzureBlobStorageEndpointFromARM
{
    param([string]$storageAccountName)

    if(-not [string]::IsNullOrEmpty($storageAccountName))
    {
        if(-not $storageAccounts.ContainsKey($storageAccountName))
        {
            throw "Unable to find storage type $storageAccountName with Connection SPN"
        }

        return  $storageAccounts[$storageAccountName]
    }
}

function Get-AzureStorageAccountTypeFromARM
{
    param([string]$storageAccountName,
          [object]$endpoint)

    if(-not [string]::IsNullOrEmpty($storageAccountName))
    {
        if(-not $storageAccounts.ContainsKey($storageAccountName))
        {
            throw "Storage account: $storageAccountName not found."
        }

        return  $storageAccounts[$storageAccountName]
    }
}

function Get-AzureStorageAccountResourceGroupName
{
    param([string]$storageAccountName)

    if (-not [string]::IsNullOrEmpty($storageAccountName))
    {
        if(-not $storageAccountsRG.ContainsKey($storageAccountName))
        {
            throw "Storage account: $storageAccountName not found. Selected Connection 'ServicePrincipal' supports storage account of Azure Resource Manager type only."
        }

        return $storageAccountsRG[$storageAccountName]
    }
}

function Get-AzureStorageKeyFromARM
{
    param([string]$storageAccountName)

    if(-not [string]::IsNullOrEmpty($storageAccountName))
    {
        if(-not $storageAccounts.ContainsKey($storageAccountName))
        {
            throw "Storage account: $storageAccountName not found. Selected Connection 'ServicePrincipal' supports storage account of Azure Resource Manager type only."
        }

        return  $storageAccounts[$storageAccountName]
    }
}

function Create-AzureStorageContext
{
      param([string]$storageAccountName,
            [string]$storageAccountKey)

    if(-not [string]::IsNullOrEmpty($storageAccountName) -and -not [string]::IsNullOrEmpty($storageAccountKey))
    {
        if(-not $storageAccounts.ContainsKey($storageAccountName))
        {
            return
        }

        return  $storageAccountsContext[$storageAccountName]
    }
}

function Get-AzureClassicVMsInResourceGroup
{
    param([string]$resourceGroupName)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and $cloudServices.ContainsKey($resourceGroupName))
    {
        return $($cloudServices[$resourceGroupName])["vms"]
    }
}

function Get-AzureRMVMsInResourceGroup
{
    param([string]$resourceGroupName)

    if(-not [string]::IsNullOrEmpty($resourceGroupName))
    {
        if(-not $resourceGroups.ContainsKey($resourceGroupName))
        {
            throw "Provided resource group '$resourceGroupName' does not exist."
        }

        if($resourceGroupDeployments.ContainsKey($resourceGroupName))
        {
            return $vmResources
        }
    }
}

function Get-AzureRMResourceGroupResourcesDetails
{
    param([string]$resourceGroupName,
          [object]$azureRMVMResources)

    if(-not [string]::IsNullOrEmpty($resourceGroupName))
    {
        if(-not $resourceGroups.ContainsKey($resourceGroupName))
        {
            throw "Resource group '$resourceGroupName' could not be found."
        }

        if($resourceGroupDeployments.ContainsKey($resourceGroupName))
        {
            return $resourceGroupDeployments[$resourceGroupName]
        }
    }

    return @{}
}

function Get-Endpoint
{
    param([string]$connectedServiceName)

    return @{
        "Data"=@{
            "EnvironmentName"="AzureStack"
        }
    }
}

function Get-AzureRMResourceGroupResourcesDetailsForAzureStack
{
    param([string]$resourceGroupName,
          [object]$azureRMVMResources,
          [string]$connectedServiceName)

    if(-not [string]::IsNullOrEmpty($resourceGroupName))
    {
        if(-not $resourceGroups.ContainsKey($resourceGroupName))
        {
            throw "Resource group '$resourceGroupName' could not be found."
        }

        if($resourceGroupDeployments.ContainsKey($resourceGroupName))
        {
            return $resourceGroupDeployments[$resourceGroupName]
        }
    }

    return @{}
}

function Generate-AzureStorageContainerSASToken
{
    param([string]$containerName,
          [object]$storageContext,
          [System.Int32]$tokenTimeOutInMinutes)

    if(-not [string]::IsNullOrEmpty($containerName) -and $storageContext)
    {
         return $validSasToken
    }
}

function Remove-AzureContainer
{

}

function Get-AzureMachineStatus
{
    param([string]$resourceGroupName,
          [string]$name)
   
    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($name))
    {
        if(-not $resourceGroups.ContainsKey($resourceGroupName))
        {
            throw "Resource group '$resourceGroupName' could not be found."
        }

        $VMs = $resourceGroups[$resourceGroupName].VMsDetails
        if($VMs -and $VMs.ContainsKey($name))
        {
            $tempExts = $vmInstanceViews[$name]["Extensions"]
            if($tempExts -and $tempExts.Count -ge 1)
            {
                $status = @{}
                $status["Extensions"] = $tempExts
                #$customScriptExtension=$tempExts[0]
            }
            else
            {
                throw "No extension exists with name '$winrmCustomScriptExtension'"
            }
        }
        else
        {
            throw "The Resource 'Microsoft.Compute/virtualMachines/$name/extensions/$winrmCustomScriptExtension' under resource group '$resourceGroupName' was not found."
        }
    }

    return $status
}

function Get-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name)

    $errMsg="The Resource 'Microsoft.Compute/virtualMachines/$vmName/extensions/$name' under resource group '$resourceGroupName' was not found."

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName))
    {
        if(-not $resourceGroups.ContainsKey($resourceGroupName))
        {
            throw "Resource group '$resourceGroupName' could not be found."
        }

        $VMs = $resourceGroups[$resourceGroupName].VMsDetails
        if($VMs -and $VMs.ContainsKey($vmName))
        {
            if($name)
            {
                $tempExts = $vmInstanceViews[$vmName]["Extensions"]
                if($tempExts -and $tempExts.Count -ge 1)
                {
                    $response = @{}
                    if($tempExts[0]["SubStatuses"][1]["Message"] -and $extension[0]["SubStatuses"][1]["Message"] -ne "")
                    {
                        $response["ProvisioningState"]="Failed"
                    }
                    else
                    {
                        $response["ProvisioningState"]="Succeeded"
                    }
                }
                else
                {
                    throw $errMsg
                }
            }
            else
            {
                throw $errMsg
            }
        }
        else
        {
            throw $errMsg
        }
    }

    return $response
}

function Set-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name,
          [string[]]$fileUri,
          [string]$run,
          [string]$argument,
          [string]$location)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName) -and -not [string]::IsNullOrEmpty($name))
    {        
        if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName))
        {
            if(-not $resourceGroups.ContainsKey($resourceGroupName))
            {
                throw "Resource group '$resourceGroupName' could not be found."
            }

            $VMs = $resourceGroups[$resourceGroupName].VMsDetails
            if($VMs -and $VMs.ContainsKey($vmName))
            {
                $response = @{}
                
                if(-not $fileUri)
                {
                    throw "Cannot validate argument on parameter 'FileUri'. The argument is null or empty."
                }

                if(-not $run)
                {
                    throw "Cannot validate argument on parameter 'Run'. The argument is null or empty."
                }
                
                if(-not $argument)
                {
                    throw "Cannot validate argument on parameter 'Argument'. The argument is null or empty."
                }

                if(-not $location)
                {
                    throw "Cannot validate argument on parameter 'Location'. The argument is null or empty."
                }

                elseif($run -eq $invalidCustomScriptName)
                {
                    $extensions[0]["SubStatuses"][1]["Message"]="The argument '$invalidCustomScriptName' to the -File parameter does not exist. Provide the path to an existing '.ps1' file as an argument to the -File parameter."
                    $errorDetails = @{"Message" = "VM has reported a failure when processing extension 'WinRMCustomScriptExtension'. Error message: Finished executing command."}
                    $response["Error"]= $errorDetails
                    $response["Status"]="Failed"
                }
                else
                {
                    $extensions[0]["SubStatuses"][1]["Message"]=""
                    $response["Status"]="Succeeded"
                }
                
                $vmInstanceViews[$vmName]["Extensions"]=$extensions
            }
            else
            {
                throw "Can not perform requested operation on nested resource. Parent resource '$vmName' not found."
            }
        }
    }

    return $response
}

function Remove-AzureMachineCustomScriptExtension
{
    param([string]$resourceGroupName,
          [string]$vmName,
          [string]$name)

    if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName) -and -not [string]::IsNullOrEmpty($name))
    {
        
        if(-not [string]::IsNullOrEmpty($resourceGroupName) -and -not [string]::IsNullOrEmpty($vmName))
        {   
            $response = @{}
            $VMs = $resourceGroups[$resourceGroupName].VMsDetails
            if($VMs -and $VMs.ContainsKey($vmName))
            {
                $tempExts = $vmInstanceViews[$vmName]["Extensions"]
                if($tempExts -and $tempExts.Count -ge 1)
                {
                    $vmInstanceViews[$vmName]["extensions"]=@()
                    $response["Status"]="Succeeded"
                }
                else
                {
                    $response["Status"]="Succeeded"
                }
            }
            else
            {
                $response["Status"]="Succeeded"
            }
        }
    }

    return $response
}

function Add-AzureNetworkSecurityRuleConfig
{
}

function Add-NetworkSecurityRuleConfig
{
    param([string]$resourceGroupName,
          [object]$securityGroups,
          [string]$ruleName,
          [string]$rulePriotity,
          [string]$winrmHttpsPort)

    if(($securityGroups.Count -gt 0) -and (-not $securityGroups[0].SecurityRules  -or $ruleName -eq $duplicateRuleName))
    {
        Add-AzureNetworkSecurityRuleConfig

        $tempRulePriority = "3986"
        if($ruleName -eq $duplicateRuleName)
        {
            $tempRulePriority = "4036"
        }

        $securityRuleProps = @{"Name"=$ruleName;"Priority"=$tempRulePriority}
        $securityRule = New-Object PSObject -Property $securityRuleProps
        $securityGroups[0].SecurityRules += $securityRule        
    }

    return $securityGroups
}

function Set-AzureNetworkSecurityGroup
{
    param([object]$NetworkSecurityGroup)

    if($NetworkSecurityGroup.Name -eq $validSecurityGroup.Name)
    {
        $validSecurityGroup = $NetworkSecurityGroup
    }

    return $validSecurityGroup
}

function Get-NetworkSecurityGroups
{
    param([string] $resourceGroupName,
          [string] $vmId)

        if($vmId -eq $vmIdWhichHasNoSecurityGroup)
        {
            return @()
        }
        elseif($vmId -eq $vmIdWhichHasSecurityGroupPrevious)
        {
            return $securityGroups
        }
        elseif($vmId -eq $vmIdWhichHasSecurityGroupRecommended)
        {
            return $securityGroupsRecommended
        }
        elseif($vmId -eq $vmIdWhichHasSecurityGroupLatest)
        {
            return $securityGroupsLatest
        }
        else
        {
            throw "[Azure Call]No network interface found with virtual machine id $vmId under resource group $rgNameWithSecurityGroup"
        }
}

# Used only in test code
function Remove-NetworkSecurityRuleConfig
{
    param([object] $securityGroups,
        [string] $ruleName)

    $validSecurityGroup["SecurityRules"]=@()
}