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

function Get-TokensFromSequence {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string] $tokenPattern,
        [Parameter(Mandatory = $true)]
        [string] $tokenSequence,
        [System.Text.RegularExpressions.RegexOptions] $regexOption = [System.Text.RegularExpressions.RegexOptions]::Compiled
    )
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
            $tokens = Get-TokensFromSequence -tokenPattern $tokenPattern -tokenSequence $tokenSequence
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
            $allKeyTokens_SemiParsed = Get-TokensFromSequence -tokenPattern $keyTokenPattern -tokenSequence $tokenSequence

            # Matches values in the list. A value begins after '=' and ends with either ',' or end of string. Values containing
            # spaces must be enclosed in double quotes.
            $valueTokenPattern = "=[ ]*([^`" ]*(`"[^`"]*`")[^`" ]*|[^`" ,]+)[ ]*(,|$)"
            $allValueTokens_SemiParsed = Get-TokensFromSequence -tokenPattern $valueTokenPattern -tokenSequence $tokenSequence
            
            if (($allKeyTokens_SemiParsed.Count -ne $result.Count) -or ($allValueTokens_SemiParsed.Count -ne $result.Count)) {
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
        $input_ScriptType = Get-VstsInput -Name "ScriptType" -Require -ErrorAction "Stop"
    
        if ($input_ScriptType -eq "FilePath") {
            $input_ScriptPath = Get-VstsInput -Name "ScriptPath" -ErrorAction "Stop"
            $input_initializationScriptPath = Get-VstsInput -Name "InitializationScript"
            $input_sessionVariables = Get-VstsInput -Name "SessionVariables"
            $sessionVariables = ConvertTo-HashTable -tokenSequence $input_sessionVariables
            $newVarCmds = @()
            foreach ($key in $sessionVariables.Keys) {
                $newVarCmds += New-CommandString -commandName "Set-Item" -arguments "-LiteralPath variable:\$key -Value $($sessionVariables[$key])"
            }
            $joinedCommand = [System.String]::Join([Environment]::NewLine, $newVarCmds)
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
            $input_failOnStderr,
            $input_initializationScriptPath,
            $joinedCommand
        )
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}