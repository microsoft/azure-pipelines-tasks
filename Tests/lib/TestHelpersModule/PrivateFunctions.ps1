function Compare-ArgumentArrays {
    [cmdletbinding()]
    param(
        [object[]]$Array1,
        [object[]]$Array2
    )

    if ($Array1.Length -ne $Array2.Length) {
        return $false
    }

    for ($i = 0 ; $i -lt $Array1.Length ; $i++) {
        $value1 = $Array1[$i]
        $value2 = $Array2[$i]
        if (($value1 -is [string]) -and ($value1 -eq '') -and ([object]::ReferenceEquals($value2, $null))) {
            # Treat the values as matching.
        } elseif (($value2 -is [string]) -and ($value2 -eq '') -and ([object]::ReferenceEquals($value1, $null))) {
            # Treat the values as matching.
        } elseif ($value1 -eq $value2) {
            # The values match.
        } else {
            return $false
        }
    }

    return $true
}

function Test-Invocation {
    [cmdletbinding()]
    param(
        [object[]]$Invocation,
        [scriptblock]$ParametersEvaluator,
        [scriptblock]$ArgumentsEvaluator,
        [object[]]$Arguments)

    if (!$ParametersEvaluator -and !$ArgumentsEvaluator -and ([object]::ReferenceEquals($Arguments, $null))) {
        return $true
    } elseif ($ParametersEvaluator) {
        $parameters = @{ }
        for ($i = 0 ; $i -lt $invocation.Length ; $i++) {
            $arg = $invocation[$i]
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
            } elseif (($i + 1) -eq $invocation.Length -or
                ($invocation[$i + 1] -is [string] -and $invocation[$i + 1] -like '-*')) {
                $parameterName = $arg.Substring(1)
                $parameterValue = $true
            } else {
                $parameterName = $arg.Substring(1)
                $parameterValue = $invocation[++$i]
            }

            $parameters[$parameterName] = $parameterValue
        }

        return $ParametersEvaluator.InvokeWithContext(
            $null,
            (@( $parameters.Keys | ForEach-Object { ,@( $_, $parameters[$_] ) }) | ForEach-Object { Set-Variable -Name $_[0] -Value $_[1] -PassThru }),
            $null)
    } elseif ($ArgumentsEvaluator) {
        return (& $ArgumentsEvaluator @invocation)
    } else {
        return (Compare-ArgumentArrays $Arguments $invocation)
    }
}

function Trace-Invocations {
    [cmdletbinding()]
    param(
        $mock
    )

    foreach ($invocation in $mock.Invocations) {
        $OFS = " "
        Write-Verbose "Discovered invocation: $invocation"
    }
}