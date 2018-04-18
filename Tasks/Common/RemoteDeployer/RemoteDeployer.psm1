. "$PSScriptRoot/SessionHelper.ps1"
. "$PSScriptRoot/RunPowerShellScriptJob.ps1"
. "$PSScriptRoot/JobHelper.ps1"
Import-VstsLocStrings "$PSScriptRoot\module.json"

function Invoke-RemoteScript {
    [CmdletBinding()]
    Param (
        [Parameter(Mandatory = $true)]
        [string[]] $targetMachineNames,

        [pscredential] $credential,

        [ValidateSet("http", "https")]
        [string] $protocol = "http",

        [ValidateSet("Default", "Credssp")]
        [string] $authentication = "Default",

        [Parameter(Mandatory = $true)]
        [string] $sessionName,

        [Parameter(Mandatory = $true)]
        [psobject] $remoteScriptJobArguments,

        [Parameter(Mandatory = $true)]
        [psobject] $sessionOption
    )
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $PSSessionOption = $sessionOption
        $sessions = @()
        foreach($targetMachineName in $targetMachineNames) {
            $sessions += ConnectTo-RemoteMachine -targetMachineName $targetMachineName `
                                                 -credential $credential `
                                                 -protocol $protocol `
                                                 -authentication $authentication `
                                                 -sessionName $sessionName        
        }
        Run-RemoteScriptJobs -sessions $sessions -script $ExecutePsScript -scriptArguments $remoteScriptJobArguments
    } finally {
        if($sessions.Count -gt 0) {
            Remove-PSSession -Session $sessions
        }
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

Export-ModuleMember -Function Invoke-RemoteScript