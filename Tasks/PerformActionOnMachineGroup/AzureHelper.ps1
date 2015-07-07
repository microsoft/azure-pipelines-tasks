function Delete-MachineGroupFromProvider
{
    param([string]$machineGroupName)

    Write-Verbose "[Azure Resource Manager]Deleting resource group $machineGroupName from Azure provider" -Verbose
    Remove-AzureResourceGroup -ResourceGroupName $machineGroupName -Force -ErrorAction Stop -Verbose
    Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Deleted resource group '{0}' from Azure provider" -ArgumentList $machineGroupName)
}

function Delete-MachineFromProvider
{
    param([string]$machineGroupName,
          [string]$machineName)
    
    $errorVariable=@()
    Write-Verbose "[Azure Resource Manager]Deleting machine $machineName from Azure provider" -Verbose
    $removeResponse = Remove-AzureVM -Name $machineName -ResourceGroupName $machineGroupName -Force -ErrorAction SilentlyContinue -ErrorVariable  errorVariable -Verbose

    if($errorVariable.Count -eq 0)
    {
         Write-Host (Get-LocalizedString -Key "[Azure Resource Manager]Deleted machine '{0}' from Azure provider" -ArgumentList $machineName)
         return "Succedded"
    }
    else
    {
         Write-Warning(Get-LocalizedString -Key "[Azure Resource Manager]Deletion of machine '{0}' failed in Azure with error '{1}'" -ArgumentList $machineName, $errorVariable)
         return "Failed"
    }
}

function Start-MachineInProvider
{
    param([string]$machineGroupName,
          [string]$machineName)

    Write-Verbose "[Azure Resource Manager]Starting machine $machineName on Azure provider" -Verbose
    Start-AzureVM -Name $machineName -ResourceGroupName $machineGroupName -ErrorAction SilentlyContinue -Verbose
}

function Stop-MachineInProvider
{
    param([string]$machineGroupName,
          [string]$machineName)

    Write-Verbose "[Azure Resource Manager]Stopping machine $machineName on Azure provider" -Verbose
    Stop-AzureVM -Name $machineName -ResourceGroupName $machineGroupName -ErrorAction SilentlyContinue -Verbose -Force
}

function Restart-MachineInProvider
{
    param([string]$machineGroupName,
          [string]$machineName)

    Write-Verbose "[Azure Resource Manager]Restarting machine $machineName on Azure provider" -Verbose
    Restart-AzureVM -Name $machineName -ResourceGroupName $machineGroupName -ErrorAction SilentlyContinue -Verbose 
}

function Initialize-AzureHelper
{
    Write-Verbose "Initializing azure resource provider" -Verbose

    Import-AzurePowerShellModule

    Switch-AzureMode AzureResourceManager

    if($machineGroup.ProviderDataList.Count -gt 0)
    {
        $providerDataName = $machineGroup.ProviderDataList[0].Name
        Write-Verbose "Getting providerData : $providerDataName" -Verbose
        $providerData = Get-ProviderData -ProviderDataName $providerDataName -Connection $connection
        $subscriptionId = $providerData.Properties.GetProperty("SubscriptionId")     
        
        if( ![string]::IsNullOrEmpty($subscriptionId) )
        {
            $serviceEndpoint = Get-ServiceEndpoint -Name $subscriptionId -Context $distributedTaskContext
            if (!$serviceEndpoint)
            {
                throw (Get-LocalizedString -Key "A Connected Service with Id '{0}' could not be found. Ensure that this Connected Service was successfully provisioned using services tab in Admin UI" -ArgumentList $subscriptionId)
            }
            if ($serviceEndpoint.Authorization.Scheme -eq 'UserNamePassword')
            {
                $username = $serviceEndpoint.Authorization.Parameters.UserName
                $password = $serviceEndpoint.Authorization.Parameters.Password
                $subscriptionName = $serviceEndpoint.Data.SubscriptionName

                $securePassword = ConvertTo-SecureString $password -AsPlainText -Force
                $psCredential = New-Object System.Management.Automation.PSCredential ($username, $securePassword)
                
                Write-Verbose "[Azure Resource Manager]Adding azure account with SubscriptionName : $subscriptionName and UserName : $userName" -Verbose
                $azureAccount = Add-AzureAccount -Credential $psCredential
                Write-Verbose "[Azure Resource Manager]Added azure account" -Verbose
                
                if(!$azureAccount)
                {
                    throw (Get-LocalizedString -Key "There was an error with the Azure credentials used for machine group deployment")
                }
                Select-AzureSubscription -SubscriptionId $subscriptionId
            }
            else
            {
                throw (Get-LocalizedString -Key "Unsupported authorization scheme for azure endpoint = '{0}'" -ArgumentList $serviceEndpoint.Authorization.Scheme)
            }                       
        }
        else
        {
            throw (Get-LocalizedString -Key "ProviderData for machine group is containing null or empty values for subscriptionId")
        }
    }
    else
    {
        throw (Get-LocalizedString -Key "No providerdata is specified in machine group")
    }

    Write-Verbose "Leaving azure-initializer" -Verbose
}
