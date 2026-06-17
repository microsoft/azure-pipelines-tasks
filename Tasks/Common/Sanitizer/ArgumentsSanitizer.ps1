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

    # When data constructors are permitted, run the structural AST backstop on the
    # RAW arguments first. This module only validates - it does not rewrite what the
    # task runs - so the raw string is exactly what PowerShell parses at the
    # dot-source sink. The relaxed character allow-list intentionally permits
    # @ { } [ ], which re-enables expressions that evaluate at bind time (a hashtable
    # value, array element, cast or sub-expression). Test-SanitizerArgumentAst
    # rejects those while still allowing pure data literals such as @{ Port = 8080 }.
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
    ## When -AllowDataConstructors is set (Group A tasks, via the dispatcher) the
    ## data-constructor characters @ { } [ ] are additionally allowed so legitimate
    ## hashtable / array arguments are not mangled (regression issue #22173). The
    ## code execution those characters could otherwise re-enable (e.g. @{ k = cmd })
    ## is blocked structurally by Test-SanitizerArgumentAst, not by this allow-list.
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

# Structural backstop for the relaxed (-AllowDataConstructors) path.
#
# A character allow-list alone cannot tell a data literal from code: once
# @ { } [ ] are permitted, an argument such as @{ k = New-Item ... }, @( cmd ),
# @{ k = $(...) } or @{ k = [type]::Member() } passes the regex yet is an
# *evaluated expression* at the dot-source sink. This was verified empirically
# against the real '. <script> <args>' / '& <script> <args>' sinks: a hashtable
# value, array element, sub-expression or cast *inside* a data constructor runs,
# whereas the same tokens at top-level argument position are inert literal
# strings.
#
# This function parses the raw arguments exactly as the sink does - as the
# argument list of a command invocation - and rejects anything that is not a
# plain data literal:
#   * a parse error,
#   * a script block, member access / method call, or type-cast expression,
#   * a nested command (more than the single placeholder CommandAst), which
#     covers commands embedded in a hashtable value, array element, or a
#     chained statement.
# Pure data literals (@{ Port = 8080 }, @('a','b')), variables including
# $env:VAR, quoted strings and numbers are accepted.
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
    $dangerous = $ast.FindAll({
            param($node)
            ($node -is [System.Management.Automation.Language.ScriptBlockExpressionAst]) -or
            ($node -is [System.Management.Automation.Language.MemberExpressionAst]) -or
            ($node -is [System.Management.Automation.Language.ConvertExpressionAst])
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
