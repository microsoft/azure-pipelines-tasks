Trace-VstsEnteringInvocation $MyInvocation
try {
    Import-VstsLocStrings "$PSScriptRoot\task.json"
    
    . "$PSScriptRoot\Utility.ps1"
    . "$PSScriptRoot\SessionHelper.ps1"

    # Get all inputs for the task
    $input_Machines = Get-VstsInput -Name "Machines" -Require -ErrorAction "Stop"
    $input_UserName = Get-VstsInput -Name "UserName" -Require -ErrorAction "Stop"
    $input_UserPassword = ConvertTo-SecureString -AsPlainText -String $(Get-VstsInput -Name "UserPassword" -Require -ErrorAction "Stop") -Force

    $input_ScriptType = Get-VstsInput -Name "ScriptType" -Require -ErrorAction "Stop"
    if ($input_ScriptType -eq "FilePath") {
        $input_ScriptPath = Get-VstsInput -Name "ScriptPath" -ErrorAction "Stop"
        $input_ScriptArguments = Get-VstsInput -Name "ScriptArguments"
    } else {
        $input_InlineScript = Get-VstsInput -Name "InlineScript"
    }

    $input_Protocol = Get-VstsInput -Name "Protocol" -Require -ErrorAction "Stop"
    $input_NewPsSessionOptionArguments = Get-VstsInput -Name "NewPsSessionOptionArguments"

    $input_ErrorActionPreference = Get-VstsInput -Name "ErrorActionPreference" -Require -ErrorAction "Stop"
    $input_failOnStderr = Get-VstsInput -Name "failOnStderr" -AsBool
    $input_ignoreLASTEXITCODE = Get-VstsInput -Name "ignoreLASTEXITCODE" -AsBool

    $input_WorkingDirectory = Get-VstsInput -Name "WorkingDirectory"
    $input_RunPowershellInParallel = Get-VstsInput -Name "RunPowershellInParallel" -AsBool

    $targetMachineNames = Parse-TargetMachineNames -machineNames $input_Machines
    $credential = Get-TargetMachineCredential -userName $input_UserName -securePassword $input_UserPassword -variableNames "input_UserName","input_UserPassword"

    $PSSessionOption = Get-NewPSSessionOption -args $input_NewPsSessionOptionArguments

    Create-PSSessionToRemoteMachines

    
    
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}