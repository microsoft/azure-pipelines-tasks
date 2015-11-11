[cmdletbinding()]
param()

Write-Verbose "Loading test helpers."
$PSModuleAutoloadingPreference = 'None'
if (!(Get-Module | Where-Object { $_.Name -eq 'Microsoft.PowerShell.Management' })) {
    Write-Verbose "Importing module: Microsoft.PowerShell.Management"
    Import-Module 'Microsoft.PowerShell.Management' -Verbose:$false
}

[hashtable]$mocks = @{ }

function Assert-AreEqual {
    [cmdletbinding()]
    param(
        [object]$Expected,
        [object]$Actual,
        [string]$Message)

    Write-Verbose "Asserting are equal. Expected: '$Expected' ; Actual: '$Actual'."
    if ($Expected -ne $Actual) {
        throw ("Assert are equal failed. Expected: '$Expected' ; Actual: '$Actual'. $Message".Trim())
    }
}

function Assert-AreNotEqual {
    [cmdletbinding()]
    param(
        [object]$NotExpected,
        [object]$Actual,
        [string]$Message)

    Write-Verbose "Asserting are not equal. Expected: '$NotExpected' ; Actual: '$Actual'."
    if ($NotExpected -eq $Actual) {
        throw ("Assert are not equal failed. Not expected: '$NotExpected' ; Actual: '$Actual'. $Message".Trim())
    }
}

function Assert-Throws {
    [cmdletbinding()]
    param(
        [ValidateNotNull()]
        [Parameter(Mandatory= $true)]
        [scriptblock]$ScriptBlock)

    Write-Verbose "Asserting script block should throw: {$ScriptBlock}"
    $didThrow = $false
    try {
        & $ScriptBlock
    } catch {
        Write-Verbose "Success. Caught exception: $($_.Exception.Message)"
        $didThrow = $true
    }

    if (!$didThrow) {
        throw "Expected script block to throw."
    }
}

function Assert-WasCalled {
    [cmdletbinding(DefaultParameterSetName = "ParametersEvaluator")]
    param(
        [ValidateNotNullOrEmpty()]
        [Parameter(Position = 1)]
        [string]$Command,

        [Parameter(ParameterSetName = "ParametersEvaluator")]
        [scriptblock]$ParametersEvaluator,

        [Parameter(ParameterSetName = "ArgumentsEvaluator")]
        [scriptblock]$ArgumentsEvaluator,

        [Parameter(ParameterSetName = "Arguments", Position = 2, ValueFromRemainingArguments = $true)]
        [object[]]$Arguments)

    # Verbose logging.
    Write-Verbose "Asserting was-called: $Command"
    if (!([object]::ReferenceEquals($Arguments, $null))) {
        $OFS = " "
        Write-Verbose "  Expected arguments: $Arguments"
    } elseif ($ParametersEvaluator) {
        Write-Verbose "  Parameters evaluator: { $($ParametersEvaluator.ToString().Trim()) }"
    } elseif ($ArgumentsEvaluator) {
        Write-Verbose "  Arguments evaluator: { $($ArgumentsEvaluator.ToString().Trim()) }"
    }

    # Sanity check the mock is registered.
    $private:mock = $mocks[$Command]
    if (!$mock) {
        throw "Mock not found for command: $Command"
    }

    if (!$ParametersEvaluator -and !$ArgumentsEvaluator -and ([object]::ReferenceEquals($Arguments, $null))) {
        if (!$mock.Invocations.Length) {
            throw "Assert was-called failed. Command was not called: $Command"
        }
    } elseif ($ParametersEvaluator) {
        $private:found = $false
        :InvocationLoop foreach ($private:invocation in $mock.Invocations) {
            if (!$invocation.Length) {
                continue
            }

            $private:parameters = @{ }
            for ($private:i = 0 ; $i -lt $invocation.Count ; $i++) {
                $private:arg = $invocation[$i]
                if ($arg -isnot [string] -or $arg -notlike '-?*') {
                    continue InvocationLoop
                }

                if ($arg -like '-?*:true') {
                    $private:parameterName = $arg.Substring(1)
                    $private:parameterName = $parameterName.Substring(0, $parameterName.Length - ':true'.Length)
                    $private:parameterValue = $true
                } elseif ($arg -like '-?*:false') {
                    $private:parameterName = $arg.Substring(1)
                    $private:parameterName = $parameterName.Substring(0, $parameterName.Length - ':false'.Length)
                    $private:parameterValue = $false
                } elseif (++$i -eq $invocation.Count) {
                    continue InvocationLoop
                } else {
                    $private:parameterName = $arg.Substring(1)
                    $private:parameterValue = $invocation[$i]
                }

                $parameters[$parameterName] = $parameterValue
            }

            $private:evaluatorWrapper = {
                $private:parameters = $args[0]
                @( $parameters.Keys | ForEach-Object { ,@( $_, $parameters[$_] ) }) |
                    ForEach-Object {
                        Set-Variable -Name $_[0] -Value $_[1] -Scope 1
                    }
                & $ParametersEvaluator
            }
                
            if (& $evaluatorWrapper $parameters) {
                $found = $true
            }
        }

        if (!$found) {
            foreach ($invocation in $mock.Invocations) {
                $OFS = " "
                Write-Verbose "Discovered registered invocations: $invocation"
            }

            throw "Assert was-called failed. Command was not called according to the specified parameters evaluator. Command: $Command; ParametersEvaluator: $($ParametersEvaluator.ToString().Trim())"
        }
    } elseif ($ArgumentsEvaluator) {
        $found = $false
        foreach ($invocation in $mock.Invocations) {
            if (& $ArgumentsEvaluator @invocation) {
                $found = $true
            }
        }

        if (!$found) {
            foreach ($invocation in $mock.Invocations) {
                $OFS = " "
                Write-Verbose "Discovered registered invocation: $invocation"
            }

            throw "Assert was-called failed. Command was not called according to the specified arguments evaluator. Command: $Command ; ArgumentsEvaluator: $($ArgumentsEvaluator.ToString().Trim())"
        }
    } else {
        $found = $false
        foreach ($invocation in $mock.Invocations) {
            if (Compare-ArgumentArrays $Arguments $invocation) {
                $found = $true
            }
        }

        if (!$found) {
            $OFS = " "
            foreach ($invocation in $mock.Invocations) {
                Write-Verbose "Discovered registered invocation: $invocation"
            }

            throw "Assert was-called failed. Command was not called with the specified arguments. Command: $Command ; Arguments: $Arguments"
        }
    }
}

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

function Register-Mock {
    [cmdletbinding(DefaultParameterSetName = "ArgumentsEvaluator")]
    param(
        [ValidateNotNullOrEmpty()]
        [Parameter(Position = 1)]
        [string]$Command,

        [Parameter(Position = 2)]
        [scriptblock]$Func,

        [Parameter(ParameterSetName = 'ArgumentsEvaluator')]
        [scriptblock]$ArgumentsEvaluator,

        [Parameter(ParameterSetName = 'Arguments', Position = 3, ValueFromRemainingArguments = $true)]
        [object[]]$Arguments)

    # Check if the command is already registered.
    $mock = $mocks[$Command]
    if (!$mock) {
        # Create the mock object.
        $mock = New-Object -TypeName psobject -Property @{
            'Command' = $Command
            'Implementations' = @( )
            'Invocations' = @( )
        }

        # Register the mock.
        $mocks[$Command] = $mock

        # Define the command.
        $null = New-Item -Path "function:\script:$Command" -Value {
            param()

            # Lookup the mock.
            $commandName = $MyInvocation.InvocationName
            Write-Verbose "Invoking mock command: $commandName"
            $mock = $mocks[$MyInvocation.InvocationName];
            if (!$mock) {
                throw "Unexpected exception. Mock not found for command: $commandName"
            }

            # Record the invocation.
            $mock.Invocations += ,$args

            # Search for a matching implementation.
            $matchingImplementation = $null
            foreach ($implementation in $mock.Implementations) {
                # Attempt to match the implementation.
                $isMatch = $false
                if (!$implementation.ArgumentsEvaluator -and ([object]::ReferenceEquals($implementation.Arguments, $null))) {
                    # Match anything if no match evaluator or arguments specified.
                    $isMatch = $true
                } elseif ($implementation.ArgumentsEvaluator -and (& $implementation.ArgumentsEvaluator @args)) {
                    # Match evaluator returned true.
                    Write-Verbose "Matching implementation found using match evaluator: { $($implementation.ArgumentsEvaluator.ToString().Trim()) }"
                    $isMatch = $true
                } elseif (!([object]::ReferenceEquals($implementation.Arguments, $null)) -and (Compare-ArgumentArrays $implementation.Arguments $args)) {
                    $OFS = " "
                    Write-Verbose "Matching implementation found using arguments: $($implementation.Arguments)"
                    $isMatch = $true
                }

                # Validate multiple matches not found.
                if ($isMatch -and $matchingImplementation) {
                    throw "Multiple matching implementations found for command: $commandName"
                }

                # Store the matching implementation.
                if ($isMatch) {
                    $matchingImplementation = $implementation
                }
            }

            # Invoke the matching implementation.
            if (($matchingImplementation -eq $null) -or ($matchingImplementation.Func -eq $null)) {
                Write-Verbose "Command is stubbed."
            } else {
                Write-Verbose "Invoking Func: { $($matchingImplementation.Func.ToString().Trim()) }"
                & $matchingImplementation.Func @args
            }
        }
    }

    # Check if an implementation is specified.
    $implementation = $null
    if ((!$Func) -and (!$ArgumentsEvaluator) -and ([object]::ReferenceEquals($Arguments, $null))) {
        Write-Verbose "Stubbing command: $Command"
    } else {
        # Add the implementation to the mock object.
        Write-Verbose "Mocking command: $Command"
        if (!([object]::ReferenceEquals($Arguments, $null))) {
            $OFS = " "
            Write-Verbose "  Arguments: $Arguments"
        }

        if ($ArgumentsEvaluator) {
            Write-Verbose "  ArgumentsEvaluator: { $($ArgumentsEvaluator.ToString().Trim()) }"
        }

        if ($Func) {
            Write-Verbose "  Func: { $($Func.ToString().Trim()) }"
        }

        $implementation = New-Object -TypeName psobject -Property @{
            'Arguments' = $Arguments
            'Func' = $Func
            'ArgumentsEvaluator' = $ArgumentsEvaluator
        }
        $mock.Implementations += $implementation
    }
}

function Register-Stub {
    [cmdletbinding()]
    param(
        [ValidateNotNullOrEmpty()]
        [string]$Command
    )

    Register-Mock -Command $Command
}

# Stub common commands.
Register-Stub -Command Import-Module
