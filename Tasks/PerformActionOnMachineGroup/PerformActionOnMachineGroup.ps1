param(
    [string][Parameter(Mandatory=$false)]$ConnectedServiceName,
    [string][Parameter(Mandatory=$true)]$MachineGroupName,
    [string][Parameter(Mandatory=$true)]$Action,
    [string][Parameter(Mandatory=$false)]$Filters,
    [string][Parameter(Mandatory=$false)]$BlockedFor,
    [string][Parameter(Mandatory=$false)]$TimeInHours
)

Write-Verbose -Verbose "Beginning action on Machine Group"
Write-Output "Entering script PerformActionOnMachineGroup.ps1"

Write-Verbose -Verbose "MachineGroupName = $MachineGroupName"
Write-Verbose -Verbose "Action = $Action"
Write-Verbose -Verbose "Filters = $Filters"
Write-Verbose -Verbose "BlockedFor = $BlockedFor"
Write-Verbose -Verbose "TimeInHours = $TimeInHours"

import-module Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs
import-module Microsoft.TeamFoundation.DistributedTask.Task.Internal
import-module Microsoft.TeamFoundation.DistributedTask.Task.Common

$ErrorActionPreference = "Stop"

. ./DtlHelper.ps1
. ./Helper.ps1
Initialize-DTLServiceHelper

$machineGroup = Get-MachineGroup -machineGroupName $MachineGroupName -filters $Filters

# if providerName is null or empty then follow same path as standard environment.
if($machineGroup.Provider -eq $null)
{
    $providerName = "Pre-existing machines"
}
else
{
	$providerName = $machineGroup.Provider.Name
}
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

   default { throw (Get-LocalizedString -Key "Machine group provider is not supported") }
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
      
      "Block" {
          Block-MachineGroup -machineGroupName $MachineGroupName -blockedFor $BlockedFor -timeInHours $TimeInHours
          break
      }
  
      "Unblock" {
          Unblock-MachineGroup -machineGroupName $MachineGroupName
          break
      }

     default { throw (Get-LocalizedString -Key "Action '{0}' is not supported on the provider '{1}'" -ArgumentList $Action, $providerName) }
}

Write-Verbose -Verbose  "Completing action on machine group"
Write-Output "Leaving script PerformActionOnResourceGroup.ps1"