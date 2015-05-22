function Initialize-DTLServiceHelper
{
    Write-Verbose "Getting the vss connection object" -Verbose
    $connection = Get-VssConnection -TaskContext $distributedTaskContext

    Set-Variable -Name connection -Value $connection -Scope "Script"
}

function Get-MachineGroup
{
    param([string]$machineGroupName,
          [string]$filters)
 
    Write-Verbose "Getting the machine group $machineGroupName" -Verbose
    $environment = Get-Environment -EnvironmentName $machineGroupName  -Connection $connection -Filters $filters -ErrorAction Stop -Verbose
    Write-Verbose "Retrieved the machine group"

    return $environment
}

function Delete-MachineGroup
{
    param([string]$machineGroupName,
          [string]$filters)

    Write-Verbose "Deleting machine group $machineGroupName" -Verbose
    # If filters are not provided then it deltes entire machine group. If filters are given then it will delete all the machines satisfing the given filters.
    if($filters)
    {
        Remove-EnvironmentResources -EnvironmentName $machineGroupName -Filters $filters -Connection $connection -ErrorAction Stop -Verbose
        Write-Verbose "Removed machines of the machine group $machineGroupName" -Verbose
    }
    else
    {
        Remove-Environment -EnvironmentName $machineGroupName -Connection $connection -ErrorAction Stop
        Write-Verbose "Deleted machine group $machineGroupName" -Verbose
    } 

}

function Invoke-MachineGroupOperation
{
     param([string]$machineGroupName,
           [string]$operationName,
           [Microsoft.VisualStudio.Services.DevTestLabs.Model.ResourceV2[]]$machines)

    Write-Verbose "Invoking $operationName for the machine group $machineGroupName" -Verbose
    $operationId = Invoke-EnvironmentOperation -EnvironmentName $machineGroupName -OperationName $operationName -ResourceNames $machines.Name -Connection $connection -ErrorAction SilentlyContinue -Verbose
    Write-Verbose "Invoked $operationName for the machine group $machineGroupName" -Verbose

    return $operationId
}

function End-MachineGroupOperation
{
    param([string]$machineGroupName,
          [string]$operationName,
          [Guid]$operationId,
          [string]$error,
          [string]$status)

    Write-Verbose "Saving $operationName details for machine group $machineGroupName" -Verbose
    Complete-EnvironmentOperation -EnvironmentName $machineGroupName -EnvironmentOperationId $operationId -Status $status -Connection $connection -ErrorMessage $error -ErrorAction SilentlyContinue -Verbose
    Write-Verbose "Saved $operationName details for machine group $machineGroupName" -Verbose
}

function End-MachineOperation
{
    param([string]$machineGroupName,
          [string]$machineName,
          [string]$operationName,
          [Guid]$operationId,
          [string]$status)

    Write-Verbose "Saving $operationName details for machine $machineName in machine group $machineGroupName" -Verbose
    Complete-EnvironmentResourceOperation -EnvironmentName $machineGroupName -ResourceName $machineName -EnvironmentOperationId $operationId -Status $status -Connection $connection -ErrorAction SilentlyContinue -Verbose
    Write-Verbose "Completed $operationName for the machine $machineName in machine group $machineGroupName" -Verbose
}

function Unblock-MachineGroup
{
    param([string]$machineGroupName)

    Write-Verbose "Invoking unblock operation for machine group $machineGroupName" -Verbose
    Invoke-UnblockEnvironment -EnvironmentName $machineGroupName -Connection $connection
    Write-Verbose "Unblocked machine group $machineGroupName" -Verbose
}

function Block-MachineGroup
{
    param([string]$machineGroupName,
          [string]$blockedFor,
          [string]$timeInHours)

    $time = $timeInHours -as [INT]
    if(($time -eq $null) -or ($time -lt 0))
    {
        Write-Error("Cannot block machine group for $timeInHours hours. Time in hours should be a positive number of hours for which machine group will be blocked")
    }
    
    Write-Verbose "Invoking block operation for machine group $machineGroupName" -Verbose
    Invoke-BlockEnvironment -EnvironmentName $machineGroupName -BlockedFor $blockedFor -TimeInHours $time -Connection $connection
    Write-Verbose "Blocked machine group $machineGroupName" -Verbose    

    Set-TaskVariable -Variable "DTL_RESERVATION_CONTEXT" -Value $blockedFor
    Write-Verbose "Task variable DTL_RESERVATION_CONTEXT set with the value $blockedFor"
}
