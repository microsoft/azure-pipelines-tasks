Trace-VstsEnteringInvocation $MyInvocation
$global:ErrorActionPreference = 'Continue'

# Undocumented VstsTaskSdk variable so Verbose/Debug isn't converted to ##vso[task.debug].
# Otherwise any content the ad-hoc script writes to the verbose pipeline gets dropped by
# the agent when System.Debug is not set.
$global:__vstsNoOverrideVerbose = $true

try {
    Import-VstsLocStrings "$PSScriptRoot\task.json"
    
    . "$PSScriptRoot\Utility.ps1"
    . "$PSScriptRoot\SessionHelper.ps1"
    . "$PSScriptRoot\JobHelper.ps1"
    . "$PSScriptRoot\RunPowerShellScriptJob.ps1"

    # Get all inputs for the task
    $input_Machines = Get-VstsInput -Name "Machines" -Require -ErrorAction "Stop"
    $input_UserName = Get-VstsInput -Name "UserName" -Require -ErrorAction "Stop"
    $input_UserPassword = ConvertTo-SecureString -AsPlainText -String $(Get-VstsInput -Name "UserPassword" -Require -ErrorAction "Stop") -Force

    $input_Protocol = Get-VstsInput -Name "Protocol" -Require -ErrorAction "Stop"
    $input_AuthenticationMechanism = Get-VstsInput -Name "AuthenticationMechanism" -Require -ErrorAction 'Stop'
    $input_NewPsSessionOptionArguments = Get-VstsInput -Name "NewPsSessionOptionArguments"

    $input_RunPowershellInParallel = Get-VstsInput -Name "RunPowershellInParallel" -AsBool

    $targetMachineNames = Parse-TargetMachineNames -machineNames $input_Machines
    $credential = Get-TargetMachineCredential -userName $input_UserName -securePassword $input_UserPassword -variableNames "input_UserName","input_UserPassword"

    $PSSessionOption = Get-NewPSSessionOption -arguments $input_NewPsSessionOptionArguments

    $sessions = ConnectTo-RemoteMachines -targetMachineNames $targetMachineNames -targetMachineCredential $credential -protocol $input_Protocol -authenticationMechanism $input_AuthenticationMechanism
    $remoteScriptJobArguments = Get-RemoteScriptJobArguments
    if($input_RunPowershellInParallel -eq $true) {
        Run-RemoteScriptJobs -sessions $sessions -script $ExecutePsScript -scriptArguments $remoteScriptJobArguments
    } else {
        ForEach($session in $sessions) {
            Run-RemoteScriptJobs -sessions $session -script $ExecutePsScript -scriptArguments $remoteScriptJobArguments            
        }
    }
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}