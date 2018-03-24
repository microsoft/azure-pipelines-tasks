function Parse-TargetMachineNames {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string] $machineNames
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Any verification on the pattern of the target machine name should be done here.
        $targetMachineNames = $machineNames.Split(',') | Where-Object { if (![string]::IsNullOrEmpty($_)) { Write-Verbose "TargetMachineName: '$_'" ; $_ } };
        return ,$targetMachineNames;
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-TargetMachineCredential {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string] $userName,
        [Parameter(Mandatory = $true)]
        [securestring] $securePassword,
        [Parameter(Mandatory = $true)]
        [ValidateCount(2,2)]
        [string[]] $variableNames
    )
    
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        return (New-Object System.Management.Automation.PSCredential($userName, $securePassword))
    } finally {
        ForEach ($variableName in $variableNames) {
            Remove-Variable -Name $variableName -Force -Scope Script -ErrorAction SilentlyContinue
        }
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-NewPSSessionOption {
    [CmdletBinding()]
    param(
        [string] $arguments
    )
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $commandString = New-CommandString -commandName "New-PSSessionOption" -arguments $arguments
        return (Invoke-Expression -Command $commandString)
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function New-CommandString {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string] $commandName,
        [string] $arguments = ""
    )
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        if (Get-Command -Name $commandName -ErrorAction "SilentlyContinue") {
            $commandString = "$commandName $arguments"
            Write-Verbose "CommandString: $commandString"
            return $commandString
        } else {
            throw (Get-VstsLocString -Key "PS_TM_CommandNotFound" -ArgumentList $commandName)
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-RemoteScriptJobArguments {
    
    $input_ScriptType = Get-VstsInput -Name "ScriptType" -Require -ErrorAction "Stop"
    
    if ($input_ScriptType -eq "FilePath") {
        $input_ScriptPath = Get-VstsInput -Name "ScriptPath" -ErrorAction "Stop"
        $inline = $false
    } else {
        $input_InlineScript = Get-VstsInput -Name "InlineScript"
        $inline = $true
    }

    $input_ScriptArguments = Get-VstsInput -Name "ScriptArguments"
    $input_ErrorActionPreference = Get-VstsInput -Name "ErrorActionPreference" -Require -ErrorAction "Stop"
    $input_failOnStderr = Get-VstsInput -Name "failOnStderr" -AsBool
    $input_ignoreLASTEXITCODE = Get-VstsInput -Name "ignoreLASTEXITCODE" -AsBool

    $input_WorkingDirectory = Get-VstsInput -Name "WorkingDirectory"

    return @(
        $input_ScriptPath,
        $input_ScriptArguments,
        $input_InlineScript,
        $inline,
        $input_WorkingDirectory,
        $input_ErrorActionPreference,
        $input_ignoreLASTEXITCODE,
        $input_failOnStderr
    )
}