function Test-AreEqual {
    [CmdletBinding()]
    param(
        [object]$Object1,
        [object]$Object2)

    $canUnravel1 = Test-CanUnravel $Object1
    $canUnravel2 = Test-CanUnravel $Object2
    if ($canUnravel1 -xor $canUnravel2) {
        # One object is fully unraveled, one is not. The objects are not equal.
        return $false
    } elseif ($canUnravel1) {
        # If one can be unraveled, both can be unraveled. Walk the arrays.
        if ($Object1.Count -ne $Object2.Count) {
            return $false
        }

        for ($i = 0 ; $i -lt $Object1.Count ; $i++) {
            if (!(Test-AreEqual $Object1[$i] $Object2[$i])) {
                return $false
            }
        }

        return $true
    } elseif (($Object1 -is [string] -and $Object1 -eq '' -and ([object]::ReferenceEquals($Object2, $null))) -or
              ($Object2 -is [string] -and $Object2 -eq '' -and ([object]::ReferenceEquals($Object1, $null)))) {
        # Treat empty string and null as a match.
        return $true
    }

    # Take a strict-ish approach. Compare both directions due to alleviate false positives due to casting issues.
    return $Object1 -eq $Object2 -and $Object2 -eq $Object1
}

function Test-CanUnravel {
    [CmdletBinding()]
    param($Object)

    return !([object]::ReferenceEquals($Object, $null)) -and
        $Object.GetType().IsClass -and
        !([object]::ReferenceEquals($Object, ($Object | ForEach-Object { $_ })))
}

function Test-Invocation {
    [CmdletBinding()]
    param(
        [object[]]$Invocation,
        [scriptblock]$ParametersEvaluator,
        [scriptblock]$ArgumentsEvaluator,
        [object[]]$Arguments)

    if (!$ParametersEvaluator -and !$ArgumentsEvaluator -and ([object]::ReferenceEquals($Arguments, $null))) {
        return $true
    } elseif ($ParametersEvaluator) {
        $parameters = @{ }
        for ($i = 0 ; $i -lt $Invocation.Length ; $i++) {
            $arg = $Invocation[$i]
            if ($arg -isnot [string] -or $arg -notlike '-?*') {
                return $false
            }

            if ($arg -like '-?*:true') {
                $parameterName = $arg.Substring(1)
                $parameterName = $parameterName.Substring(0, $parameterName.Length - ':true'.Length)
                $parameterValue = $true
            } elseif ($arg -like '-?*:false') {
                $parameterName = $arg.Substring(1)
                $parameterName = $parameterName.Substring(0, $parameterName.Length - ':false'.Length)
                $parameterValue = $false
            } elseif (($i + 1) -eq $Invocation.Length -or
                ($Invocation[$i + 1] -is [string] -and $Invocation[$i + 1] -like '-*')) {
                $parameterName = $arg.Substring(1)
                $parameterValue = $true
            } else {
                $parameterName = $arg.Substring(1)
                $parameterValue = $Invocation[++$i]
            }

            $parameters[$parameterName] = $parameterValue
        }

        return $ParametersEvaluator.InvokeWithContext(
            $null,
            (@( $parameters.Keys | ForEach-Object { ,@( $_, $parameters[$_] ) }) | ForEach-Object { Set-Variable -Name $_[0] -Value $_[1] -PassThru }),
            $null)
    } elseif ($ArgumentsEvaluator) {
        return (& $ArgumentsEvaluator @Invocation)
    } else {
        return (Test-AreEqual $Arguments $Invocation)
    }
}

function Trace-Invocations {
    [CmdletBinding()]
    param($mock)

    foreach ($invocation in $mock.Invocations) {
        $OFS = " "
        Write-Verbose "Discovered invocation:"
        for ($i = 0 ; $i -lt $invocation.Count ; $i++) {
            Write-Verbose "  args[$i]: $($invocation[$i])"
        }
    }
}
