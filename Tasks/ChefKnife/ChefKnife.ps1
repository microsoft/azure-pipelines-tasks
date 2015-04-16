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

Write-Host "Entering script ChefKnife.ps1"

Import-Module "Microsoft.TeamFoundation.DistributedTask.Task.Deployment.Chef"

#ENSURE: We pass arguments verbatim on the command line to the custom script
Write-Host "ScriptArguments= " $ScriptArguments
Write-Host "ScriptPath= " $ScriptPath

$scriptCommand = "& `"$ScriptPath`" $scriptArguments"
Write-Host "scriptCommand=" $scriptCommand

try
{
    #fetching chef subscription details 
    $connectedServiceDetails = Get-ConnectedServiceDetails -Context $distributedTaskContext -ConnectedServiceName $connectedServiceName
    #setting up chef repo with the chef subscription details fetched before 
    Setup-ChefRepo $connectedServiceDetails 
    Invoke-Expression -Command $scriptCommand
}
finally
{
    #delete temporary chef repo
    if ([string]::IsNullOrEmpty($global:chefRepo) -eq $false)
    {
        Write-Verbose "Deleting Chef Repo" -verbose
        Remove-Item -Recurse -Force $global:chefRepo
        Write-Verbose "Chef Repo Deleted" -verbose
    }
}

Write-Host "Leaving script ChefKnife.ps1"