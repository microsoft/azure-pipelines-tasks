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

function Assert-IsNullOrEmpty {
    [cmdletbinding()]
    param(
        [object]$Actual,
        [string]$Message)

    Write-Verbose "Asserting is null or empty."
    if ($Actual) {
        throw ("Assert is null or empty failed. Actual: '$Actual'. $Message".Trim())
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

    # Get the mock.
    $mock = $mocks[$Command]
    if (!$mock) {
        throw "Mock not found for command: $Command"
    }

    # Test was-called.
    $found = $false
    foreach ($invocation in $mock.Invocations) {
        if (Test-Invocation -Invocation $invocation -ParametersEvaluator $ParametersEvaluator -ArgumentsEvaluator $ArgumentsEvaluator -Arguments $Arguments) {
            $found = $true
        }
    }

    # Throw if not found.
    if (!$found) {
        Trace-Invocations -Mock $mock
        if (!$ParametersEvaluator -and !$ArgumentsEvaluator -and ([object]::ReferenceEquals($Arguments, $null))) {
            throw "Assert was-called failed. Command was not called: $Command"
        } elseif ($ParametersEvaluator) {
            throw "Assert was-called failed. Command was not called according to the specified parameters evaluator. Command: $Command; ParametersEvaluator: $($ParametersEvaluator.ToString().Trim())"
        } elseif ($ArgumentsEvaluator) {
            throw "Assert was-called failed. Command was not called according to the specified arguments evaluator. Command: $Command ; ArgumentsEvaluator: $($ArgumentsEvaluator.ToString().Trim())"
        } else {
            throw "Assert was-called failed. Command was not called with the specified arguments. Command: $Command ; Arguments: $Arguments"
        }
    }
}

function Register-Mock {
    [cmdletbinding(DefaultParameterSetName = "ParametersEvaluator")]
    param(
        [ValidateNotNullOrEmpty()]
        [Parameter(Position = 1)]
        [string]$Command,

        [Parameter(Position = 2)]
        [scriptblock]$Func,

        [Parameter(ParameterSetName = "ParametersEvaluator")]
        [scriptblock]$ParametersEvaluator,

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
        $null = New-Item -Path "function:\global:$Command" -Value {
            param()

            # Lookup the mock.
            $commandName = $MyInvocation.InvocationName
            Write-Verbose "Invoking mock command: $commandName"
            $OFS = " "
            Write-Verbose "  Arguments: $args"
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
                if (Test-Invocation -Invocation $args -ParametersEvaluator $implementation.ParametersEvaluator -ArgumentsEvaluator $implementation.ArgumentsEvaluator -Arguments $implementation.Arguments) {
                    # Verbose logging.
                    if ($implementation.ParametersEvaluator) {
                        Write-Verbose "Matching implementation found using parameters evaluator: { $($implementation.ParametersEvaluator.ToString().Trim()) }"
                    } elseif ($implementation.ArgumentsEvaluator) {
                        Write-Verbose "Matching implementation found using arguments evaluator: { $($implementation.ArgumentsEvaluator.ToString().Trim()) }"
                    } elseif (!([object]::ReferenceEquals($implementation.Arguments, $null))) {
                        $OFS = " "
                        Write-Verbose "Matching implementation found using arguments: $($implementation.Arguments)"
                    }

                    # Validate multiple matches not found.
                    if ($matchingImplementation) {
                        throw "Multiple matching implementations found for command: $commandName"
                    }

                    # Store the matching implementation.
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
    if ((!$Func) -and (!$ParametersEvaluator) -and (!$ArgumentsEvaluator) -and ([object]::ReferenceEquals($Arguments, $null))) {
        Write-Verbose "Stubbing command: $Command"
    } else {
        # Add the implementation to the mock object.
        Write-Verbose "Mocking command: $Command"
        if (!([object]::ReferenceEquals($Arguments, $null))) {
            $OFS = " "
            Write-Verbose "  Arguments: $Arguments"
        } elseif ($ParametersEvaluator) {
            Write-Verbose "  ParametersEvaluator: { $($ParametersEvaluator.ToString().Trim()) }"
        } elseif ($ArgumentsEvaluator) {
            Write-Verbose "  ArgumentsEvaluator: { $($ArgumentsEvaluator.ToString().Trim()) }"
        }

        if ($Func) {
            Write-Verbose "  Func: { $($Func.ToString().Trim()) }"
        }

        $implementation = New-Object -TypeName psobject -Property @{
            'Arguments' = $Arguments
            'ArgumentsEvaluator' = $ArgumentsEvaluator
            'Func' = $Func
            'ParametersEvaluator' = $ParametersEvaluator
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
