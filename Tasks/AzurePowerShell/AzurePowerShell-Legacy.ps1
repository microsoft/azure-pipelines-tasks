[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)]
    $ConnectedServiceNameSelector,    

    [String]
    $ConnectedServiceName,

    [String]
    $ConnectedServiceNameARM,

    [String] [Parameter(Mandatory = $true)]
    $ScriptPath,

    [String] [Parameter(Mandatory = $false)]
    $ScriptArguments
)

Write-Verbose "Entering script RunAzurePowerShell.ps1"

#ENSURE: We pass arguments verbatim on the command line to the custom script
Write-Host "ScriptArguments= $ScriptArguments"
Write-Host "ScriptPath= $ScriptPath"

$scriptCommand = "& `"$ScriptPath`" $scriptArguments"
Write-Host "scriptCommand= $scriptCommand"
Invoke-Expression -Command $scriptCommand

Write-Verbose "Leaving script RunAzurePowerShell.ps1"