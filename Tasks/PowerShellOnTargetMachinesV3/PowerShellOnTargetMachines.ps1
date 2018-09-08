Trace-VstsEnteringInvocation $MyInvocation
$global:ErrorActionPreference = 'Continue'
$global:__vstsNoOverrideVerbose = $true

try {
    Import-VstsLocStrings "$PSScriptRoot\task.json"
    Import-Module -Name "$PSScriptRoot\ps_modules\RemoteDeployer\RemoteDeployer.psm1"
    
    . "$PSScriptRoot\Utility.ps1"

    # Get all inputs for the task
    $input_Machines = Get-VstsInput -Name "Machines" -Require -ErrorAction "Stop"
    $input_AuthenticationMechanism = Get-VstsInput -Name "AuthenticationMechanism" -Require -ErrorAction 'Stop'

    if ($input_AuthenticationMechanism.ToLowerInvariant() -eq "default") {
        # It is not mandatory that a credential be provided in case of default auth
        $input_UserName = Get-VstsInput -Name "UserName"
    } elseif ($input_AuthenticationMechanism.ToLowerInvariant() -eq "credssp") {
        # But for credssp, credentials are mandatory ( -ErrorAction 'Stop' )
        $input_UserName = Get-VstsInput -Name "UserName" -Require -ErrorAction 'Stop'
    }

    if(![string]::IsNullOrEmpty($input_UserName)) {
        $input_UserPassword = Get-VstsInput -Name "UserPassword" -Require -ErrorAction 'Stop'
        $credential = Get-TargetMachineCredential -userName $input_UserName -password $input_UserPassword
    } else {
        $credential = $null
    }

    $input_Protocol = Get-VstsInput -Name "CommunicationProtocol" -Require -ErrorAction "Stop"
    $input_NewPsSessionOptionArguments = Get-VstsInput -Name "NewPsSessionOptionArguments"
    $input_RunPowershellInParallel = Get-VstsInput -Name "RunPowershellInParallel" -AsBool
    # connecting to a specific powershell configuration can be supported here eg. 'microsoft.powershell32' for a 32 bit session etc.
    $input_sessionConfigurationName = 'microsoft.powershell'

    if([string]::IsNullOrEmpty($input_sessionConfigurationName)) {
        throw (Get-VstsLocString -Key "PS_TM_SessionConfigurationNameCannotBeNull")
    }

    $targetMachineNames = Parse-TargetMachineNames -machineNames $input_Machines

    $sessionOption = Get-NewPSSessionOption -arguments $input_NewPsSessionOptionArguments

    $remoteScriptJobArguments = Get-RemoteScriptJobArguments

    $jobResults = @()
    if($input_RunPowershellInParallel -eq $true) {
        $jobResults = Invoke-RemoteScript -targetMachineNames $targetMachineNames `
                                          -credential $credential `
                                          -protocol $input_Protocol `
                                          -authentication $input_AuthenticationMechanism `
                                          -sessionConfigurationName $input_sessionConfigurationName `
                                          -remoteScriptJobArguments $remoteScriptJobArguments `
                                          -sessionOption $sessionOption `
                                          -uploadLogFiles
    } else {
        foreach($targetMachineName in $targetMachineNames) {
            $jobResults += Invoke-RemoteScript  -targetMachineNames @($targetMachineName) `
                                                -credential $credential `
                                                -protocol $input_Protocol `
                                                -authentication $input_AuthenticationMechanism `
                                                -sessionConfigurationName $input_sessionConfigurationName `
                                                -remoteScriptJobArguments $remoteScriptJobArguments `
                                                -sessionOption $sessionOption `
                                                -uploadLogFiles
        }
    }
} catch {
    Write-Verbose "Exception caught from task: $($_.Exception.ToString())"
    throw
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}