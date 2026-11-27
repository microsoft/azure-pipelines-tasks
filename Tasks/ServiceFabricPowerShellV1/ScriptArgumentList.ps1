# Converts the ScriptArguments input into values that are splatted to the user script
# (& $scriptPath @named @positional), so the arguments are bound as data and are never
# evaluated as part of a generated PowerShell command.
#
# Supported argument values: bare words, quoted strings, numbers, $true, $false, $null,
# $env: variables (also inside double-quoted strings), and arrays/hashtables made of these.
# Anything else (commands, sub-expressions, other variables, script blocks, multiple
# statements, pipelines or redirections) is rejected.
function ConvertTo-ScriptArgumentList {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ScriptPath,
        [string]$ScriptArguments
    )

    # Reason and AstType are fixed values that are safe to publish in telemetry; the
    # argument text is only included in the message shown in the pipeline log.
    function New-UnsupportedArgumentsError([string]$Reason, [System.Management.Automation.Language.Ast]$Ast) {
        $exception = New-Object System.Exception (Get-VstsLocString -Key UnsupportedScriptArguments0 -ArgumentList $ScriptArguments)
        $exception.Data['Reason'] = $Reason
        if ($Ast) {
            $exception.Data['AstType'] = $Ast.GetType().Name
        }

        $exception
    }

    function Test-IsEnvironmentVariable([System.Management.Automation.Language.Ast]$Ast) {
        $Ast -is [System.Management.Automation.Language.VariableExpressionAst] -and
            !$Ast.Splatted -and
            $Ast.VariablePath.DriveName -eq 'env'
    }

    function Get-ArgumentValue([System.Management.Automation.Language.Ast]$Ast) {
        $scriptBlocks = $Ast.FindAll({ $args[0] -is [System.Management.Automation.Language.ScriptBlockExpressionAst] }, $true)
        if (@($scriptBlocks).Count) {
            throw (New-UnsupportedArgumentsError -Reason 'ScriptBlock')
        }

        # Stop-parsing token: the rest of the line would be passed through unparsed.
        if ($Ast -is [System.Management.Automation.Language.StringConstantExpressionAst] -and
            $Ast.StringConstantType -eq [System.Management.Automation.Language.StringConstantType]::BareWord -and
            $Ast.Value -eq '--%') {
            throw (New-UnsupportedArgumentsError -Reason 'StopParsing')
        }

        if (Test-IsEnvironmentVariable $Ast) {
            return [System.Environment]::GetEnvironmentVariable($Ast.VariablePath.UserPath.Split(':', 2)[1])
        }

        if ($Ast -is [System.Management.Automation.Language.ExpandableStringExpressionAst]) {
            foreach ($nestedExpression in $Ast.NestedExpressions) {
                if (!(Test-IsEnvironmentVariable $nestedExpression)) {
                    throw (New-UnsupportedArgumentsError -Reason 'ExpandableString' -Ast $nestedExpression)
                }
            }

            # Every nested expression was verified to be an $env: variable read.
            return $ExecutionContext.InvokeCommand.ExpandString($Ast.Value)
        }

        try {
            return $Ast.SafeGetValue()
        }
        catch {
            throw (New-UnsupportedArgumentsError -Reason 'NonConstantValue' -Ast $Ast)
        }
    }

    function Get-ScriptParameter($Parameters, [string]$Name) {
        if (!$Parameters) {
            return $null
        }

        foreach ($parameter in $Parameters.Values) {
            if ($parameter.Name -eq $Name -or $parameter.Aliases -contains $Name) {
                return $parameter
            }
        }

        # PowerShell also binds unambiguous parameter name prefixes.
        $prefixMatches = @($Parameters.Values | Where-Object { $_.Name.StartsWith($Name, [System.StringComparison]::OrdinalIgnoreCase) })
        if ($prefixMatches.Count -eq 1) {
            return $prefixMatches[0]
        }

        return $null
    }

    $named = @{ }
    $positional = New-Object System.Collections.Generic.List[object]
    if ([string]::IsNullOrWhiteSpace($ScriptArguments)) {
        return New-Object psobject -Property @{ Named = $named; Positional = $positional.ToArray() }
    }

    $tokens = $null
    $parseErrors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseInput("& placeholder $ScriptArguments", [ref]$tokens, [ref]$parseErrors)
    if ($parseErrors) {
        throw (New-UnsupportedArgumentsError -Reason 'ParseError')
    }

    if ($ast.EndBlock.Statements.Count -ne 1 -or $ast.EndBlock.Traps) {
        throw (New-UnsupportedArgumentsError -Reason 'MultipleStatements')
    }

    $pipelineAst = $ast.EndBlock.Statements[0] -as [System.Management.Automation.Language.PipelineAst]
    if ($pipelineAst -and $pipelineAst.PipelineElements.Count -ne 1) {
        throw (New-UnsupportedArgumentsError -Reason 'Pipeline')
    }

    $commandAst = $null
    if ($pipelineAst) {
        $commandAst = $pipelineAst.PipelineElements[0] -as [System.Management.Automation.Language.CommandAst]
    }

    if (!$commandAst -or
        $commandAst.InvocationOperator -ne [System.Management.Automation.Language.TokenKind]::Ampersand) {
        throw (New-UnsupportedArgumentsError -Reason 'InvalidStructure')
    }

    if ($commandAst.Redirections.Count) {
        throw (New-UnsupportedArgumentsError -Reason 'Redirection')
    }

    # Script parameter metadata is needed to bind switches the same way PowerShell does.
    $parameters = $null
    try {
        $parameters = (Get-Command -Name $ScriptPath -CommandType ExternalScript -ErrorAction Stop).Parameters
    }
    catch {
        Write-Verbose "Unable to read parameters of '$ScriptPath': $($_.Exception.Message)"
    }

    $elements = $commandAst.CommandElements
    for ($i = 1; $i -lt $elements.Count; $i++) {
        $element = $elements[$i]
        if ($element -isnot [System.Management.Automation.Language.CommandParameterAst]) {
            $positional.Add((Get-ArgumentValue $element))
            continue
        }

        $parameter = Get-ScriptParameter $parameters $element.ParameterName
        $name = if ($parameter) { $parameter.Name } else { $element.ParameterName }
        if ($named.ContainsKey($name)) {
            throw (New-UnsupportedArgumentsError -Reason 'DuplicateParameter')
        }

        if ($element.Argument) {
            $named[$name] = Get-ArgumentValue $element.Argument
        }
        elseif ($parameter -and $parameter.SwitchParameter) {
            $named[$name] = $true
        }
        elseif ($i + 1 -lt $elements.Count -and $elements[$i + 1] -isnot [System.Management.Automation.Language.CommandParameterAst]) {
            $i++
            $named[$name] = Get-ArgumentValue $elements[$i]
        }
        elseif (!$parameter) {
            $named[$name] = $true
        }
        else {
            throw (New-UnsupportedArgumentsError -Reason 'MissingParameterValue')
        }
    }

    return New-Object psobject -Property @{ Named = $named; Positional = $positional.ToArray() }
}

# Publishes usage of the argument list invocation. Only fixed values and counts are
# published: never argument text, parameter names, values or paths.
function Publish-ScriptArgumentListTelemetry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('FilePath', 'InlineScript')]
        [string]$ScriptType,
        [object]$ArgumentList,
        [System.Management.Automation.ErrorRecord]$ErrorRecord
    )

    $telemetry = @{
        argumentListInvocation = $true
        scriptType = $ScriptType
        rejected = $null -ne $ErrorRecord
    }

    if ($ArgumentList) {
        $telemetry.namedCount = @($ArgumentList.Named.Keys).Count
        $telemetry.positionalCount = @($ArgumentList.Positional).Count
    }

    if ($ErrorRecord) {
        $knownReasons = @('ParseError', 'MultipleStatements', 'Pipeline', 'InvalidStructure', 'Redirection',
            'ScriptBlock', 'StopParsing', 'ExpandableString', 'NonConstantValue', 'DuplicateParameter', 'MissingParameterValue')
        $reason = [string]$ErrorRecord.Exception.Data['Reason']
        $telemetry.reason = if ($knownReasons -ccontains $reason) { $reason } else { 'Unexpected' }
        $astType = [string]$ErrorRecord.Exception.Data['AstType']
        if ($astType -cmatch '^[A-Za-z]+Ast$') {
            $telemetry.astType = $astType
        }
    }

    $telemetryJson = $telemetry | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=TaskHub;feature=ServiceFabricPowerShellV1]$telemetryJson"
}
