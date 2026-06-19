. $PSScriptRoot\Expand-EnvVariables.ps1

$featureFlags = @{
    activate  = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_NEW_LOGIC)
    audit     = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_NEW_LOGIC_LOG)
    telemetry = [System.Convert]::ToBoolean($env:AZP_75787_ENABLE_COLLECT)
}

Write-Verbose "Feature flag AZP_75787_ENABLE_NEW_LOGIC state: $($featureFlags.activate)"
Write-Verbose "Feature flag AZP_75787_ENABLE_NEW_LOGIC_LOG state: $($featureFlags.audit)"
Write-Verbose "Feature flag AZP_75787_ENABLE_COLLECT state: $($featureFlags.telemetry)"

$taskName = ""

# public functions - start

function Get-SanitizerFeatureFlags {
    return $featureFlags
}

function Get-SanitizerCallStatus {
    return $featureFlags.activate -or $featureFlags.audit -or $featureFlags.telemetry
}

function Get-SanitizerActivateStatus {
    $activateFlag = $featureFlags.activate
    Write-Verbose "Feature flag AZP_75787_ENABLE_NEW_LOGIC state: $activateFlag"
    return $activateFlag
}

# This is a wrapper for Get-SanitizedArguments to handle feature flags in one place
# It will return sanitized arguments string if feature flag is enabled
function Protect-ScriptArguments([string]$inputArgs, [string]$taskName, [switch]$AllowDataConstructors) {
    $script:taskName = $taskName

    # In the relaxed mode, run the structural AST backstop on the RAW arguments
    # first. This module only validates - it does not rewrite what the task runs -
    # so the raw string is exactly what PowerShell parses at the dot-source sink.
    # The relaxed allow-list permits @ { } [ ], which re-enables expressions that
    # evaluate at bind time (a hashtable value, cast or sub-expression);
    # Test-SanitizerArgumentAst rejects those while still allowing pure data
    # literals such as @{ Port = 8080 }.
    $astSafe = $true
    if ($AllowDataConstructors) {
        $astSafe = Test-SanitizerArgumentAst $inputArgs
    }

    $expandedArgs, $expandTelemetry = Expand-EnvVariables $inputArgs;

    $sanitizedArgs, $sanitizeTelemetry = Get-SanitizedArguments -InputArgs $expandedArgs -AllowDataConstructors:$AllowDataConstructors

    if (($sanitizedArgs -eq $inputArgs) -and $astSafe) {
        Write-Debug 'Arguments passed sanitization without change.'
    }
    else {
        if ($featureFlags.telemetry) {
            $telemetry = $expandTelemetry;
            if ($null -ne $sanitizeTelemetry) {
                $telemetry += $sanitizeTelemetry;
            }
            if (-not $astSafe) {
                if ($null -eq $telemetry) {
                    $telemetry = @{}
                }
                $telemetry.astBackstopRejected = $true
            }
            Publish-Telemetry $telemetry;
        }

        if (($sanitizedArgs -ne $expandedArgs) -or (-not $astSafe)) {
            $message = (Get-VstsLocString -Key 'PS_ScriptArgsSanitized');

            if ($featureFlags.activate) {
                Write-Error $message
                throw $message
            }
            elseif ($featureFlags.audit) {
                Write-VstsTaskWarning -Message $message -AuditAction 1
            }
        }
    }

    $arrayOfArguments = Split-Arguments -Arguments $sanitizedArgs
    return $arrayOfArguments
}

# public functions - end

# !ATTENTION: don't write any console output in this method, because it will break result
function Get-SanitizedArguments([string]$inputArgs, [switch]$AllowDataConstructors) {
    $removedSymbolSign = '_#removed#_';
    $argsSplitSymbols = '``';
    [string[][]]$matchesChunks = @()

    ## PowerShell Regex is case insensitive by default, so we don't need to specify a-zA-Z.
    ## ('?<!`') - checking if before character no backtick.
    ## ([^\w` _'"-=\/:\.*,+~?%\n#]) - checking if character is allowed. Insead replacing to #removed#
    ## (?!true|false) - checking if after characters sequence no $true or $false.
    ##
    ## Two validation modes exist because there are two groups of tasks:
    ##   * Strict (default) - the regex below. Used by the long-standing direct
    ##     callers; their behavior must stay exactly the same.
    ##   * Relaxed (-AllowDataConstructors) - additionally allows the data-
    ##     constructor characters @ { } [ ] so legitimate hashtable params are not
    ##     mangled. Any code execution those characters could re-enable (e.g.
    ##     @{ k = cmd }) is blocked structurally by Test-SanitizerArgumentAst,
    ##     not by this allow-list. (@(...) arrays stay blocked in both modes -
    ##     parentheses are never allowed.)
    ## Long-term these two modes should be unified into one consistent validation.
    if ($AllowDataConstructors) {
        $regex = '(?<!`)([^\w\\` _''"\-=\/:\.*,+~?%\n#@{}\[\]])(?!true|false)'
    }
    else {
        $regex = '(?<!`)([^\w\\` _''"\-=\/:\.*,+~?%\n#])(?!true|false)'
    }

    # We're splitting by ``, removing all suspicious characters and then join
    $argsArr = $inputArgs -split $argsSplitSymbols;

    for ($i = 0; $i -lt $argsArr.Length; $i++ ) {
        [string[]]$matches = (Select-String $regex -input $argsArr[$i] -AllMatches) | ForEach-Object { $_.Matches }
        if ($null -ne $matches ) {
            $matchesChunks += , $matches;
            $argsArr[$i] = $argsArr[$i] -replace $regex, $removedSymbolSign;
        }
    }

    $resultArgs = $argsArr -join $argsSplitSymbols;

    $telemetry = $null
    if ( $resultArgs -ne $inputArgs) {
        $argMatches = $matchesChunks | ForEach-Object { $_ } | Where-Object { $_ -ne $null }
        $telemetry = @{
            removedSymbols      = Join-Matches -Matches $argMatches
            removedSymbolsCount = $argMatches.Count
        }
    }

    return $($resultArgs, $telemetry);
}

# Structural backstop for the relaxed validation mode.
#
# A character allow-list alone cannot tell a data literal from code: once
# @ { } [ ] are permitted, an argument such as @{ k = New-Item ... },
# @{ k = $(...) } or @{ k = [type]::Member() } passes the regex yet is an
# evaluated expression at the dot-source sink - a hashtable value, cast or
# sub-expression inside a data constructor runs, whereas the same tokens at
# top-level argument position are inert literal strings.
#
# This function parses the raw arguments exactly as the sink does - as the
# argument list of a command invocation - and rejects anything that is not a
# plain data literal:
#   * a parse error,
#   * a script block, member access / method call, type-cast, the -as
#     conversion operator, or a bare type reference,
#   * a nested command (more than the single placeholder CommandAst), which
#     covers commands embedded in a hashtable value or a chained statement.
# Pure data literals (@{ Port = 8080 }), variables including $env:VAR, quoted
# strings and numbers are accepted. (@(...) arrays pass this check but are still
# rejected by the character allow-list, which does not permit parentheses.)
#
# Returns $true when the arguments are safe, $false when a dangerous construct
# is present.
function Test-SanitizerArgumentAst([string]$inputArgs) {
    if ([string]::IsNullOrWhiteSpace($inputArgs)) {
        return $true
    }

    $tokens = $null
    $parseErrors = $null
    # A literal placeholder command name keeps the parse focused on the argument
    # expressions and mirrors how the arguments reach the sink.
    $ast = [System.Management.Automation.Language.Parser]::ParseInput(
        "& placeholder $inputArgs", [ref]$tokens, [ref]$parseErrors)

    if ($parseErrors -and $parseErrors.Count -gt 0) {
        return $false
    }

    # InvokeMemberExpressionAst derives from MemberExpressionAst, so the single
    # MemberExpressionAst check covers both property getters and method calls.
    # ConvertExpressionAst is the [type]$x / [type]'x' cast; the -as conversion
    # operator (a BinaryExpressionAst with the 'As' operator) is the semantically
    # equivalent form and likewise invokes the target type's constructor /
    # type-converter at the sink - verified to execute with both a [type] literal
    # and a string/variable right operand - so it must be rejected too. A bare
    # TypeExpressionAst (a type reference used as a value inside a data constructor)
    # is never needed in pure data and is blocked for good measure; top-level type
    # literals passed as plain arguments do not parse as TypeExpressionAst and
    # remain allowed.
    $dangerous = $ast.FindAll({
            param($node)
            ($node -is [System.Management.Automation.Language.ScriptBlockExpressionAst]) -or
            ($node -is [System.Management.Automation.Language.MemberExpressionAst]) -or
            ($node -is [System.Management.Automation.Language.ConvertExpressionAst]) -or
            ($node -is [System.Management.Automation.Language.TypeExpressionAst]) -or
            (($node -is [System.Management.Automation.Language.BinaryExpressionAst]) -and
             ($node.Operator -eq [System.Management.Automation.Language.TokenKind]::As))
        }, $true)
    if ($dangerous -and $dangerous.Count -gt 0) {
        return $false
    }

    # Exactly one CommandAst is expected - our placeholder. Any additional
    # CommandAst means a command nested inside a data constructor or a chained
    # statement.
    $commandAsts = $ast.FindAll({
            param($node)
            $node -is [System.Management.Automation.Language.CommandAst]
        }, $true)
    if ($commandAsts.Count -gt 1) {
        return $false
    }

    return $true
}

function Publish-Telemetry($telemetry) {
    $area = 'TaskHub'
    $feature = $script:taskName
    $telemetryJson = $telemetry | ConvertTo-Json -Compress
    Write-Host "##vso[telemetry.publish area=$area;feature=$feature]$telemetryJson"
}

# Splits a string into array of arguments, considering quotes.
function Split-Arguments {
    [OutputType([String[]])]
    param(
        [string]$arguments
    )

    # If the incoming arguments string is null or empty or space, return an empty array
    if ([string]::IsNullOrWhiteSpace($arguments)) {
        return New-Object string[] 0
    }

    # Use regular expression to match all possible formats of arguments:
    # 1) "arg" (enclosed in double quotes)
    # 2) 'arg' (enclosed in single quotes)
    # 3) arg (not enclosed in quotes)
    # Each match found by the regular expression will have several groups.
    # Group[0] is the whole match, Group[1] is the match for "arg", Group[2] is the match for 'arg'.
    $matchesList = [System.Text.RegularExpressions.Regex]::Matches($arguments, "`"([^`"]*)`"|'([^']*)'|[^ ]+")

    $result = @()

    foreach ($match in $matchesList) {
        # Attempt to get the argument from Group[1] (for "arg").
        $arg = $match.Groups[1].Value

        # If Group[1] didn't have a match (was not "arg" format), try Group[2] (for 'arg').
        if ([string]::IsNullOrEmpty($arg)) {
            $arg = $match.Groups[2].Value
        }

        # If neither Group[1] nor Group[2] had a match (was not enclosed in quotes), use the whole match (Group[0]).
        if ([string]::IsNullOrEmpty($arg)) {
            $arg = $match.Groups[0].Value
        }

        # Add the extracted argument to the result array.
        $result += $arg
    }

    return $result
}

function Join-Matches {
    param (
        [Parameter(Mandatory = $true)]
        [String[]]$Matches
    )

    $matchesData = @{}
    foreach ($m in $Matches) {
        if ($matchesData.ContainsKey($m)) {
            $matchesData[$m]++
        }
        else {
            $matchesData[$m] = 1
        }
    }

    return $matchesData
}
