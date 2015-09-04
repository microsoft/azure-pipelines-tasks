function Delete-MachineGroupFromProvider
{
    param([string]$machineGroupName)

    Write-Verbose "Skipping delete operation on machinegroup $machineGroupName for pre-existing machines" -Verbose
}

function Delete-MachineFromProvider
{
    param([string]$machineGroupName,
          [string]$machineName)

    Write-Verbose "Skipping delete operation on machine $machineName on pre-existing machines" -Verbose
    return "Succedded"
}

function Start-MachineInProvider
{
    param([string]$machineGroupName,
          [string]$machineName)

    throw (Get-LocalizedString -Key "Start operation is not supported by the pre-existing machines")
}

function Stop-MachineInProvider
{
    param([string]$machineGroupName,
          [string]$machineName)

    throw (Get-LocalizedString -Key "Stop operation is not supported by the pre-existing machines")
}

function Restart-MachineInProvider
{
    param([string]$machineGroupName,
          [string]$machineName)

    throw (Get-LocalizedString -Key "Restart operation is not supported by the pre-existing machines")
}