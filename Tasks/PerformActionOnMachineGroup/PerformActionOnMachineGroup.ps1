param(
    [string][Parameter(Mandatory=$true)]$ConnectedServiceName, 
    [string][Parameter(Mandatory=$true)]$MachineGroupName,
    [string][Parameter(Mandatory=$true)]$Action,
    [string][Parameter(Mandatory=$false)]$Filters
)

Write-Verbose -Verbose "Beginning action on Machine Group"
Write-Output "Entering script PerformActionOnMachineGroup.ps1"

Write-Verbose -Verbose "SubscriptionId = $ConnectedServiceName"
Write-Verbose -Verbose "MachineGroupName = $MachineGroupName"
Write-Verbose -Verbose "Action = $Action"

import-module Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs
import-module Microsoft.TeamFoundation.DistributedTask.Task.Common

$ErrorActionPreference = "Stop"

. ./DtlHelper.ps1
. ./Helper.ps1
Initialize-DTLServiceHelper

$machineGroup = Get-MachineGroup -machineGroupName $MachineGroupName -filters $Filters

$providerName = $machineGroup.Provider.Name
Write-Verbose -Verbose "ProviderName = $providerName"

# Loads the required file based on the provider , so that functions in that provider are called.
Switch ($providerName)
{
   "AzureResourceGroupManagerV2" {             
       . ./AzureHelper.ps1
       Initialize-AzureHelper
       break
   }

   "Pre-existing machines" {
        . ./PreExistingMachinesHelper.ps1
        break
   }

   default { Write-Error("Machine group provider is not supported.") }
}

# Determines which action is to be performed.
# Whenever a new action is added it should be added in all the providers.

Switch ($Action)
{
     "Delete" {
         Delete-MachinesHelper -machineGroupName $MachineGroupName -filters $Filters -machines $machineGroup.Resources
         break
      }

     { @("Start", "Stop", "Restart") -contains $_ } {
         Invoke-OperationHelper -machineGroupName $MachineGroupName -operationName $Action -machines $machineGroup.Resources
         break
      }

     default { Write-Error("Action $action is not supported on the provider $providerName.") }
}

Write-Verbose -Verbose  "Completing action on machine group"
Write-Output "Leaving script PerformActionOnResourceGroup.ps1"