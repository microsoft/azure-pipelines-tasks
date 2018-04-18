. "$PSScriptRoot/SessionHelper.ps1"
. "$PSScriptRoot/RunPowerShellScriptJob.ps1"
. "$PSScriptRoot/JobHelper.ps1"
Import-VstsLocStrings "$PSScriptRoot\module.json"

#Invoke a script remotely on a set of machines. 2 types of script execution are supported: 
# 1. Script File (should be already present on Target Machine)
# 2. Inline Script
#
#.DESCRIPTION
#Long description
#
#.PARAMETER targetMachineNames
# array of target machine names. target machine names can be of the form <fqdn>:<port>, <fqdn>, <ip>:<port>, <ip>
#
#.PARAMETER credential
# credential to be used to connect to remote machines. The username specified should be a part of
# the administrators or Windows Remote Management Users group. If no credential is specified, then the 
# the account with which the agent is running is picked
#
#.PARAMETER protocol
# can be http or https
#
#.PARAMETER authentication
# can be 'Default' or 'Credssp'. If Credssp is specified, credential is mandatory.
# credssp setup on client and server needs to be done beforehand.
#
#.PARAMETER sessionName
# name of the pssession that connects to target machines
#
#.PARAMETER remoteScriptJobArguments
# an array wherein each member is treated as follows (strictly this order should be followed):
# 1. scriptPath
# 2. scriptArguments
# 3. inlineScript
# 4. [bool] $inline
# 5. workingDirectory
# 6. _errorActionPreference
# 7. [bool] _ignoreLASTEXITCODE
# 8. [bool] failOnStdErr
# 9. initializationScriptPath
# 10. sessionVariables
#
#.PARAMETER sessionOption
# the session option object to be used for creating sessions.
# eg. for skipping ca check, create a new session option object ( New-PSSession -SkipCACheck ) and pass as an argument.
#
#.EXAMPLE
#An example
#
#.NOTES
#General notes
##############################

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

        [string] $sessionConfigurationName = "microsoft.powershell",

        [Parameter(Mandatory = $true)]
        [psobject] $remoteScriptJobArguments,

        [Parameter(Mandatory = $true)]
        [psobject] $sessionOption
    )
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $PSSessionOption = $sessionOption
        $PSSessionConfigurationName = $sessionConfigurationName
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