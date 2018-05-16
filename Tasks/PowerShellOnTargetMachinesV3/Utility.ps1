function Parse-TargetMachineNames {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string] $machineNames,
        [ValidateNotNullOrEmpty()]
        [char] $separator = ','
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $targetMachineNames = $machineNames.ToLowerInvariant().Split($separator) |
        # multiple connections to the same machine are filtered here
            Select-Object -Unique |
                ForEach-Object {
                    if (![string]::IsNullOrEmpty($_)) {
                        Write-Verbose "TargetMachineName: '$_'" ;
                        $_.ToLowerInvariant()
                    } 
                }
            
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
        [ValidateNotNullOrEmpty()]
        [string] $password
    )

    Trace-VstsEnteringInvocation $MyInvocation -Parameter "userName"
    try {
        Write-VstsSetSecret -Value $password
        $securePassword = ConvertTo-SecureString -AsPlainText -String $password -Force
        return (New-Object System.Management.Automation.PSCredential($userName, $securePassword))
    } finally {
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
        $commandString = "New-PSSessionOption $arguments"
        Write-Verbose "New-PSSessionOption command: $commandString"
        return (Invoke-Expression -Command $commandString)
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-RemoteScriptJobArguments {
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $scriptArgumentsByName = @{
            scriptPath = "";
            scriptArguments = "";
            inlineScript = "";
            inline = $false;
            workingDirectory = "";
            errorActionPreference = "continue";
            ignoreLASTEXITCODE = $false;
            failOnStdErr = $false;
            initializationScriptPath = "";
            sessionVariables = "";
        }

        $input_ScriptType = Get-VstsInput -Name "ScriptType" -Require -ErrorAction "Stop"
    
        if ($input_ScriptType -eq "FilePath") {
            $input_ScriptPath = Get-VstsInput -Name "ScriptPath" -ErrorAction "Stop"
            $input_ScriptArguments = Get-VstsInput -Name "ScriptArguments"
            $input_initializationScriptPath = Get-VstsInput -Name "InitializationScript"
            $input_sessionVariables = Get-VstsInput -Name "SessionVariables"
            try {
                $sessionVariablesScript = [scriptblock]::Create($input_sessionVariables)
            } catch {
                Write-Verbose $($_.Exception.ToString())
                throw (Get-VstsLocString -Key "PS_TM_UnableToParseSessionVariables" -ArgumentList $($_.Exception.Message))
            }
            $inline = $false
        } else {
            $input_InlineScript = Get-VstsInput -Name "InlineScript"
            $sessionVariablesScript = ""
            $input_initializationScriptPath = ""
            $inline = $true
        }
    
        $input_ErrorActionPreference = Get-VstsInput -Name "ErrorActionPreference" -Require -ErrorAction "Stop"
        $input_failOnStderr = Get-VstsInput -Name "failOnStderr" -AsBool
        $input_ignoreLASTEXITCODE = Get-VstsInput -Name "ignoreLASTEXITCODE" -AsBool
        $input_WorkingDirectory = Get-VstsInput -Name "WorkingDirectory"
    
        $scriptArgumentsByName.scriptPath = $input_ScriptPath
        $scriptArgumentsByName.scriptArguments = $input_ScriptArguments
        $scriptArgumentsByName.inlineScript = $input_InlineScript
        $scriptArgumentsByName.inline = $inline
        $scriptArgumentsByName.workingDirectory = $input_WorkingDirectory
        $scriptArgumentsByName.errorActionPreference = $input_ErrorActionPreference
        $scriptArgumentsByName.ignoreLASTEXITCODE = $input_ignoreLASTEXITCODE
        $scriptArgumentsByName.failOnStdErr = $input_failOnStderr
        $scriptArgumentsByName.initializationScriptPath = $input_initializationScriptPath
        $scriptArgumentsByName.sessionVariables = $sessionVariablesScript.ToString()

        return $scriptArgumentsByName
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}