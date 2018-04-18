Trace-VstsEnteringInvocation $MyInvocation
$global:ErrorActionPreference = 'Continue'

# Undocumented VstsTaskSdk variable so Verbose/Debug isn't converted to ##vso[task.debug].
# Otherwise any content the ad-hoc script writes to the verbose pipeline gets dropped by
# the agent when System.Debug is not set.
$global:__vstsNoOverrideVerbose = $true

try {
    Import-VstsLocStrings "$PSScriptRoot\task.json"
    Import-Module -Name "$PSScriptRoot\ps_modules\RemoteDeployer\RemoteDeployer.psm1"
    
    . "$PSScriptRoot\Utility.ps1"

    # Get all inputs for the task
    $input_Machines = Get-VstsInput -Name "Machines" -Require -ErrorAction "Stop"
    $input_AuthenticationMechanism = Get-VstsInput -Name "AuthenticationMechanism" -Require -ErrorAction 'Stop'

    if ($input_AuthenticationMechanism.ToLowerInvariant() -eq "default") {
        $input_UserName = Get-VstsInput -Name "UserName"
    } elseif ($input_AuthenticationMechanism.ToLowerInvariant() -eq "credssp") {
        $input_UserName = Get-VstsInput -Name "UserName" -Require -ErrorAction 'Stop'
    }

    if(![string]::IsNullOrEmpty($input_UserName)) {
        $input_UserPassword = Get-VstsInput -Name "UserPassword" -Require -ErrorAction 'Stop'
        $credential = Get-TargetMachineCredential -userName $input_UserName -password $input_UserPassword
    } else {
        $credential = $null
    }

    $input_Protocol = Get-VstsInput -Name "Protocol" -Require -ErrorAction "Stop"
    $input_NewPsSessionOptionArguments = Get-VstsInput -Name "NewPsSessionOptionArguments"
    $input_RunPowershellInParallel = Get-VstsInput -Name "RunPowershellInParallel" -AsBool
    $input_sessionConfigurationName = $(Get-VstsInput -Name "SessionConfigurationName").Trim()

    if([string]::IsNullOrEmpty($input_sessionConfigurationName)) {
        throw (Get-VstsLocString -Key "PS_TM_SessionConfigurationNameCannotBeNull")
    }

    $targetMachineNames = Parse-TargetMachineNames -machineNames $input_Machines

    $sessionOption = Get-NewPSSessionOption -arguments $input_NewPsSessionOptionArguments

    $remoteScriptJobArguments = Get-RemoteScriptJobArguments
    $sessionName = [Guid]::NewGuid().ToString();

    if($input_RunPowershellInParallel -eq $true) {
        Invoke-RemoteScript -targetMachineNames $targetMachineNames `
                            -credential $credential `
                            -protocol $input_Protocol `
                            -authentication $input_AuthenticationMechanism `
                            -sessionName $sessionName `
                            -sessionConfigurationName $input_sessionConfigurationName `
                            -remoteScriptJobArguments $remoteScriptJobArguments `
                            -sessionOption $sessionOption
    } else {
        foreach($targetMachineName in $targetMachineNames) {
            Invoke-RemoteScript -targetMachineNames @($targetMachineName) `
                                -credential $credential `
                                -protocol $input_Protocol `
                                -authentication $input_AuthenticationMechanism `
                                -sessionName $sessionName `
                                -sessionConfigurationName $input_sessionConfigurationName `
                                -remoteScriptJobArguments $remoteScriptJobArguments `
                                -sessionOption $sessionOption
        }
    }
} catch {
    Write-Verbose "Exception caught from task: $($_.Exception.ToString())"
    Write-VstsSetResult -Result 'Failed' -Message (Get-VstsLocString -Key "PS_TM_TaskFailed" -ArgumentList $_.Exception.Message) -DoNotThrow
    throw
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}