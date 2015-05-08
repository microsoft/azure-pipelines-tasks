function Invoke-OperationHelper
{
     param([string]$machineGroupName,
           [string]$operationName,
          [Microsoft.VisualStudio.Services.DevTestLabs.Model.ResourceV2[]]$machines)

    Write-Verbose "Entered perform action $operationName on machines for machine group $machineGroupName" -Verbose
    
    if(! $machines)
    {
        return
    }

    $machineStatus = "Succeeded"
    
    # Logs in the Dtl service that operation has started.
    $operationId = Invoke-MachineGroupOperation -machineGroupName $machineGroupName -operationName $operationName -machines $machines

    if($machines.Count -gt 0)
    {
       $passedOperationCount = $machines.Count
    }

    Foreach($machine in $machines)
    {
        $operation = Invoke-OperationOnProvider -machineGroupName $machineGroupName -machineName $machine.Name -operationName $operationName

        # Determines the status of the operation. Marks the status of machine group operation as 'Failed' if any one of the machine operation fails.
        if(! $operation)
        {
            $status = "Failed"
            $machineStatus = "Failed"
            Write-Warning("Operation $operation on machine $machine.Name failed.")
        }
        else
        {
            $status = $operation.Status
            if($status -ne "Succeeded")
            {
                $machineStatus = "Failed"
                $passedOperationCount--
                Write-Warning("Operation $operationName on machine $machine.Name failed with error $operation.Error")
            }
        }

        # Logs the completion of particular machine operation. Updates the status based on the provider response.
        End-MachineOperation -machineGroupName $machineGroupName -machineName $machine.Name -operationName $operationName -operationId $operationId -status $status -error $operation.Error
    }
    
    # Logs completion of the machine group operation.
    End-MachineGroupOperation -machineGroupName $machineGroupName -operationName operationName -operationId $operationId -status $machineStatus
    Throw-ExceptionIfOperationFailesOnAllMachine -passedOperationCount $passedOperationCount -operationName $operationName -machineGroupName $machineGroupName
}

function Delete-MachinesHelper
{
    param([string]$machineGroupName,
          [string]$filters,
          [Microsoft.VisualStudio.Services.DevTestLabs.Model.ResourceV2[]]$machines)

    Write-Verbose "Entered delete machines for the machine group $machineGroupName" -Verbose

    # If filters are not provided then deletes the entire machine group.
    if(! $Filters)
    {
       Delete-MachineGroupFromProvider -machineGroupName $MachineGroupName
    }
    else
    {
      # If there are no machines corresponding to given machine names or tags then will not delete any machine.
      if(! $machines -or $machines.Count -eq 0)
      {
          return
      }
  
      $passedOperationCount = $machines.Count
      Foreach($machine in $machines)
      {
          $response = Delete-MachineFromProvider -machineGroupName $machineGroupName -machineName $machine.Name 
          if($response -ne "Succedded")
           {
              $passedOperationCount--
           }
          else
           {
              $filter = $filter + $machine.Name + ","
           }
      }
    }
    
    Throw-ExceptionIfOperationFailesOnAllMachine -passedOperationCount $passedOperationCount -operationName $operationName -machineGroupName $machineGroupName
    # Deletes the machine or machine group from Dtl
    Delete-MachineGroup -machineGroupName $MachineGroupName -filters $filter
}

function Invoke-OperationOnProvider
{
    param([string]$machineGroupName,
          [string]$machineName,
          [string]$operationName)
 
    # Performes the operation on provider based on the operation name.
    Switch ($operationName)
    {
         "Start" {
             $operation = Start-MachineInProvider -machineGroupName $machineGroupName -machineName $machineName
         }

         "Stop" {
             $operation = Stop-MachineInProvider -machineGroupName $machineGroupName -machineName $machineName
         }

         "Restart" {
             $operation = Restart-MachineInProvider -machineGroupName $machineGroupName -machineName $machineName
         }
 
         default {
              Write-Error("Tried to invoke an invalid operation: $operationName.")
         }
    }
    return $operation
}

# Task fails if operation fails on all the machines
function Throw-ExceptionIfOperationFailesOnAllMachine
{
   param([string]$passedOperationCount,
         [string]$operationName,
         [string]$machineGroupName)

  if(($passedOperationCount -ne $null) -and ($passedOperationCount -eq 0))
  {
        Write-Error("Operation $operationName failed on the machines in $machineGroupName")
  }
}