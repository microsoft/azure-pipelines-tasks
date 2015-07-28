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

Write-Verbose "Entering script RunAzurePowerShell.ps1"

#ENSURE: We pass arguments verbatim on the command line to the custom script
Write-Host "ScriptArguments= $ScriptArguments"
Write-Host "ScriptPath= $ScriptPath"

$scriptCommand = "& `"$ScriptPath`" $scriptArguments"
Write-Host "scriptCommand= $scriptCommand"
Invoke-Expression -Command $scriptCommand
if ($LASTEXITCODE -ne 0) {
    Write-Error -Message "##[error]BUILD FAILED: $LASTEXITCODE"
}

Write-Verbose "Leaving script RunAzurePowerShell.ps1"
