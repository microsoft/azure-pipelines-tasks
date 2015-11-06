[cmdletbinding()]
param()

Write-Verbose "Loading test helpers."
$PSModuleAutoloadingPreference = 'None'
Import-Module 'Microsoft.PowerShell.Management' -Verbose:$false
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
    [cmdletbinding(DefaultParameterSetName = "MatchEvaluator")]
    param(
        [ValidateNotNullOrEmpty()]
        [Parameter(Position = 1)]
        [string]$Command,

        [Parameter(ParameterSetName = "MatchEvaluator")]
        [scriptblock]$MatchEvaluator,

        [Parameter(ParameterSetName = "Arguments", Position = 2, ValueFromRemainingArguments = $true)]
        [object[]]$Arguments)

    # Check if the command is already registered.
    Write-Verbose "Asserting was-called: $Command"
    if (!([object]::ReferenceEquals($Arguments, $null))) {
        $OFS = " "
        Write-Verbose "  Expected arguments: $Arguments"
    }

    if ($MatchEvaluator) {
        Write-Verbose "  Match evaluator: $($MatchEvaluator.ToString().Trim())"
    }

    $registration = $mocks[$Command]
    if (!$registration) {
        throw "Mock registration not found for command: $Command"
    }

    if (!$MatchEvaluator -and ([object]::ReferenceEquals($Arguments, $null))) {
        if (!$registration.Invocations.Length) {
            throw "Assert was-called failed. Command was not called: $Command"
        }
    } elseif ($MatchEvaluator) {
        $found = $false
        foreach ($invocation in $registration.Invocations) {
            if (& $MatchEvaluator @invocation) {
                $found = $true
            }
        }

        if (!$found) {
            foreach ($invocation in $registration.Invocations) {
                $OFS = " "
                Write-Verbose "Discovered registered invocation: $invocation"
            }

            throw "Assert was-called failed. Command was not called according to the specified match evaluator. Command: $Command ; MatchEvaluator: $($MatchEvaluator.ToString().Trim())"
        }
    } else {
        $found = $false
        foreach ($invocation in $registration.Invocations) {
            if (Compare-ArgumentArrays $Arguments $invocation) {
                $found = $true
            }
        }

        if (!$found) {
            $OFS = " "
            foreach ($invocation in $registration.Invocations) {
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
    [cmdletbinding(DefaultParameterSetName = "MatchEvaluator")]
    param(
        [ValidateNotNullOrEmpty()]
        [Parameter(Position = 1)]
        [string]$Command,

        [Parameter(Position = 2)]
        [scriptblock]$Func,

        [Parameter(ParameterSetName = 'MatchEvaluator')]
        [scriptblock]$MatchEvaluator,

        [Parameter(ParameterSetName = 'Arguments', Position = 3, ValueFromRemainingArguments = $true)]
        [object[]]$Arguments)

    # Check if the command is already registered.
    $registration = $mocks[$Command]
    if (!$registration) {
        # Create the registration object.
        $registration = New-Object -TypeName psobject -Property @{
            'Command' = $Command
            'Implementations' = @( )
            'Invocations' = @( )
        }

        # Register the mock.
        $mocks[$Command] = $registration

        # Define the command.
        $null = New-Item -Path "function:\script:$Command" -Value {
            param()

            # Lookup the registration.
            $commandName = $MyInvocation.InvocationName
            Write-Verbose "Invoking mock command: $commandName"
            $registration = $mocks[$MyInvocation.InvocationName];
            if (!$registration) {
                throw "Unexpected exception. Registration not found for command: $commandName"
            }

            # Record the invocation.
            $registration.Invocations += ,$args

            # Search for a matching implementation.
            $matchingImplementation = $null
            foreach ($implementation in $registration.Implementations) {
                # Attempt to match the implementation.
                $isMatch = $false
                if (!$implementation.MatchEvaluator -and ([object]::ReferenceEquals($implementation.Arguments, $null))) {
                    # Match anything if no match evaluator or arguments specified.
                    $isMatch = $true
                } elseif ($implementation.MatchEvaluator -and (& $implementation.MatchEvaluator @args)) {
                    # Match evaluator returned true.
                    Write-Verbose "Matching implementation found using match evaluator: { $($implementation.MatchEvaluator.ToString().Trim()) }"
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
    if ((!$Func) -and (!$MatchEvaluator) -and ([object]::ReferenceEquals($Arguments, $null))) {
        Write-Verbose "Stubbing command: $Command"
    } else {
        # Add the implementation to the registration object.
        Write-Verbose "Mocking command: $Command"
        if (!([object]::ReferenceEquals($Arguments, $null))) {
            $OFS = " "
            Write-Verbose "  Arguments: $Arguments"
        }

        if ($MatchEvaluator) {
            Write-Verbose "  MatchEvaluator: { $($MatchEvaluator.ToString().Trim()) }"
        }

        if ($Func) {
            Write-Verbose "  Func: { $($Func.ToString().Trim()) }"
        }

        $implementation = New-Object -TypeName psobject -Property @{
            'Arguments' = $Arguments
            'Func' = $Func
            'MatchEvaluator' = $MatchEvaluator
        }
        $registration.Implementations += $implementation
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
