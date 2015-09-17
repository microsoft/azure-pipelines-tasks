Param(
    [string][Parameter(Mandatory = $true)]$ConnectedServiceName,
    [string][Parameter(Mandatory = $true)]$ServiceName,
    [string]$RemoveStagingSlot,
    [string]$WaitInstancesReady,
    [string]$CheckInterval,
    [string]$CheckTimeout
)

function Remove-Deployment {
    param(
        [string]$serviceName,
        [string]$slot
    )
    
    $azureDeployment = Get-AzureDeployment -ServiceName $serviceName -Slot $slot -ErrorAction SilentlyContinue
    if(!$azureDeployment) {
        Write-Warning "$slot slot is empty, skipping delete operation"
    } else {
        Write-Host "Removing deployment from $slot"
        Write-Host "Remove-AzureDeployment -ServiceName $serviceName -Slot $slot -Force"
        Remove-AzureDeployment -ServiceName $serviceName -Slot $slot -Force
    }
}

function Move-Deployment {
    param(
        [string]$serviceName
    )

    Write-Host "Swapping $serviceName"
    Write-Host "Move-AzureDeployment -ServiceName $serviceName"
    $status = Move-AzureDeployment -ServiceName $serviceName

    Write-Host "VIP Swap result: $($status.OperationStatus)"
    if ($status.OperationStatus -ne "Succeeded") {
        throw "Swap operation failed, OperationId: $($status.OperationId), OperationStatus: $($status.OperationStatus)"
    }
}

function Test-Instances {
    param(
        [object]$instances
    )
    $readyStatus = "ReadyRole"
    $instances | foreach {
        if ($_.InstanceStatus -ne $readyStatus)
        {
            return $false
        }
    }
    return $true
}

function Wait-InstancesReady {
    param(
        [string]$serviceName,
        [string]$slot,
        [int]$checkInterval,
        [int]$checkTimeout
    )

    $stopWatch = [System.Diagnostics.Stopwatch]::StartNew()

    Write-Host "Waiting until instances of $serviceName reaching ready state"

    do {
        $azureDeployment = Get-AzureDeployment -ServiceName $serviceName -Slot $slot -ErrorAction SilentlyContinue

        $instanceState = Test-Instances $azureDeployment.RoleInstanceList

        if($instanceState -eq $false) {
            if($stopWatch.Elapsed.TotalSeconds -gt $checkTimeout){
                throw "$checkTimeout seconds elapsed but the instances have not reached the ready state"
            }
        
            Write-Host "Instances of $serviceName"
            $azureDeployment.RoleInstanceList | foreach {
                Write-Host "$($_.InstanceName): $($_.InstanceStatus)"
            }
            Write-Host "Recheck after $checkInterval seconds"
            Start-Sleep -Seconds $checkInterval
        }

    } while ($instanceState -eq $false)
}

Write-Verbose "Entering script $($MyInvocation.MyCommand.Name)"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

Write-Verbose "Parameter values:"
foreach($key in $PSBoundParameters.Keys) {
    Write-Verbose ($key + ' = ' + $PSBoundParameters[$key])
}

$waitInstancesReady = Convert-String $WaitInstancesReady Boolean
$removeStagingSlot = Convert-String $RemoveStagingSlot Boolean
$checkInterval = [System.Int32]::Parse($CheckInterval)
$checkTimeout = [System.Int32]::Parse($CheckTimeout)

Write-Host "Get-AzureDeployment -ServiceName $serviceName -Slot $slot -ErrorAction SilentlyContinue"
$azureDeployment = Get-AzureDeployment -ServiceName $serviceName -Slot Staging -ErrorAction SilentlyContinue
if(!$azureDeployment) {
    Write-Warning "Staging slot is empty, swap couldn't be made"
    return
}

if($waitInstancesReady -eq $true) {
    Wait-InstancesReady $ServiceName Staging $checkInterval $checkTimeout
}

Move-Deployment $ServiceName

if($removeStagingSlot -eq $true) {
    Remove-Deployment $ServiceName Staging
}

Write-Verbose "Leaving script $($MyInvocation.MyCommand.Name)"