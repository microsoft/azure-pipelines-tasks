function Delete-MachineGroupFromProvider
{
    param([string]$machineGroupName)

    Write-Verbose "Deleting resource group $machineGroupName from Azure provider" -Verbose
    Remove-AzureResourceGroup -ResourceGroupName $machineGroupName -Force -ErrorAction Stop -Verbose
    Write-Verbose "Deleted resource group $machineGroupName from Azure provider"-Verbose
}

function Delete-MachineFromProvider
{
    param([string]$machineGroupName,
          [string]$machineName)
    
    $errorVariable=@()
    Write-Verbose "Deleting machine $machineName from Azure provider" -Verbose
    $removeResponse = Remove-AzureVM -Name $machineName -ResourceGroupName $machineGroupName -Force -ErrorAction SilentlyContinue -ErrorVariable  errorVariable -Verbose

    if($errorVariable.Count -eq 0)
    {
         Write-Verbose "Deleted machine $machineName from Azure provider" -Verbose
         return "Succedded"
    }
    else
    {
         Write-Warning("Deletion of machine $machineName failed in azure with error $errorVaraible")
         return "Failed"
    }
}

function Start-MachineInProvider
{
    param([string]$machineGroupName,
          [string]$machineName)

    Write-Verbose "Starting machine $machineName on Azure provider" -Verbose
    Start-AzureVM -Name $machineName -ResourceGroupName $machineGroupName -ErrorAction SilentlyContinue -Verbose
    Write-Verbose "Started machine $machineName on Azure provider" -Verbose
}

function Stop-MachineInProvider
{
    param([string]$machineGroupName,
          [string]$machineName)

    Write-Verbose "Stopping machine $machineName on Azure provider" -Verbose
    Stop-AzureVM -Name $machineName -ResourceGroupName $machineGroupName -ErrorAction SilentlyContinue -Verbose -Force
    Write-Verbose "Stopped machine $machineName on Azure provider" -Verbose
}

function Restart-MachineInProvider
{
    param([string]$machineGroupName,
          [string]$machineName)

    Write-Verbose "Restarting machine $machineName on Azure provider" -Verbose
    Restart-AzureVM -Name $machineName -ResourceGroupName $machineGroupName -ErrorAction SilentlyContinue -Verbose 
    Write-Verbose "Restarted machine $machineName on Azure provider" -Verbose
}

function Initialize-AzureHelper
{
    Switch-AzureMode AzureResourceManager
    Write-Verbose "Switched to AzureResourceManager" -Verbose
}
