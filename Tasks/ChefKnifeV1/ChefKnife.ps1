[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)]
    $ConnectedServiceName,

    [String] [Parameter(Mandatory = $true)]
    $ScriptPath,

    [String] [Parameter(Mandatory = $false)]
    $ScriptArguments
)

Write-Verbose "Entering script ChefKnife.ps1"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Chef"

#ENSURE: We pass arguments verbatim on the command line to the custom script
Write-Verbose "ScriptArguments = $ScriptArguments" -Verbose
Write-Verbose "ScriptPath= $ScriptPath"  -Verbose

$scriptCommand = "& `"$ScriptPath`" $scriptArguments"
Write-Verbose "scriptCommand= $scriptCommand"  -Verbose

try
{
    #fetching chef subscription details 
    $connectedServiceDetails = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName
    #setting up chef repo with the chef subscription details fetched before 
    Initialize-ChefRepo $connectedServiceDetails 
    Invoke-Expression -Command $scriptCommand
}
finally
{
    #delete temporary chef repo
    if ([string]::IsNullOrEmpty($global:chefRepo) -eq $false)
    {
        Write-Verbose "Deleting Chef Repo" 
        Remove-Item -Recurse -Force $global:chefRepo
        Write-Verbose "Chef Repo Deleted" 
    }
}

Write-Verbose "Leaving script ChefKnife.ps1" 