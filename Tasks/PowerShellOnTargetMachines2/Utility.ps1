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

function Get-TokensFromSequence {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string] $tokenPattern,
        [Parameter(Mandatory = $true)]
        [string] $tokenSequence
    )
    $regexOption = [System.Text.RegularExpressions.RegexOptions]::Compiled
    $regex = New-Object regex -ArgumentList $tokenPattern, $regexOption
    return ($regex.Matches($tokenSequence))
}

function ConvertTo-HashTable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string] $tokenSequence
    )
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $result = @{}
        if (![string]::IsNullOrEmpty($tokenSequence))  {
            # Matches all keys and values present in a comma separated list of key value pairs. Key-Values are separated
            # by '=' and a pair is separated by ','. Parsed values can be of form : val, "val val2", val"val2"val3.
            $tokenPattern = "([^`" =,]*(`"[^`"]*`")[^`" =,]*)|[^`" =,]+"
            $tokens = Get-TokensFromSequence $tokenPattern $tokenSequence
            $currentKey = [string]::Empty

            foreach ($token in $tokens) {
                if ($token.Value.StartsWith('$')) {
                    if (![string]::IsNullOrEmpty($currentKey)) {
                        throw (Get-VstsLocString -Key "PS_TM_ParseSessionVariablesValueNotFound" -ArgumentList $($token.Value), $currentKey)
                    }
                    $currentKey = $token.Value.Trim('$')
                    Write-Verbose "Adding Key:'$currentKey' Value:''"
                    $result.Add($currentKey, [string]::Empty)
                } elseif (!$token.Value.StartsWith('$') -and ![string]::IsNullOrEmpty($currentKey)) {
                    Write-Verbose "Setting Key:'$currentKey' Value:'$($token.Value)'"
                    $result[$currentKey] = $token.Value
                    $currentKey = [string]::Empty
                } else {
                    throw (Get-VstsLocString -Key "PS_TM_ParseSessionVariablesKeyNotFound" -ArgumentList $($token.Value), $currentKey)
                }
            }
    
            if (![string]::IsNullOrEmpty($currentKey)) {
                throw (Get-VstsLocString -Key "PS_TM_ParseSessionVariablesValueNotFound" -ArgumentList [string]::Empty, $currentKey)
            }
    
            # Matches keys in the list. A key begins with '$' and ends with '='. It cannot contain spaces, double quotes.
            $keyTokenPattern = "(\$[^`" =]+)[ ]*="
            $allKeyTokens_SemiParsed = Get-TokensFromSequence $keyTokenPattern $tokenSequence

            # Matches values in the list. A value begins after '=' and ends with either ',' or end of string. Values containing
            # spaces must be enclosed in double quotes.
            $valueTokenPattern = "=[ ]*([^`" ]*(`"[^`"]*`")[^`" ]*|[^`" ,]+)[ ]*(,|$)"
            $allValueTokens_SemiParsed = Get-TokensFromSequence $valueTokenPattern $tokenSequence
            
            Write-Verbose "Number of keys: $($allKeyTokens_SemiParsed.Count)"
            Write-Verbose "Number of values: $($allValueTokens_SemiParsed.Count)"
            if (($allKeyTokens_SemiParsed.Count -ne $result.Count) -or 
                ($allValueTokens_SemiParsed.Count -ne $result.Count)) {
                throw (Get-VstsLocString -Key "PS_TM_InvalidSessionVariablesInputFormat")
            }
        }
        return $result
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
            $sessionVariables = ConvertTo-HashTable -tokenSequence $input_sessionVariables
            # sessionVariables is a newline separated list of set-item commands which are executed right before the target script.
            $newVarCmds = @()
            foreach ($key in $sessionVariables.Keys) {
                $newVarCmds += "Set-Item -LiteralPath variable:\$key -Value '$($sessionVariables[$key])'"
            }
            $allNewVarCommands = [System.String]::Join([Environment]::NewLine, $newVarCmds)
            $inline = $false
        } else {
            $input_InlineScript = Get-VstsInput -Name "InlineScript"
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
        $scriptArgumentsByName.sessionVariables = $allNewVarCommands

        return $scriptArgumentsByName
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}