function Assert-AreEqual {
    [CmdletBinding()]
    param([object]$Expected, [object]$Actual, [string]$Message)

    Write-Verbose "Asserting are equal. Expected: '$Expected' ; Actual: '$Actual'."
    if (!(Test-AreEqual $Expected $Actual)) {
        throw ("Assert are equal failed. Expected: '$Expected' ; Actual: '$Actual'. $Message".Trim())
    }
}

function Assert-AreNotEqual {
    [CmdletBinding()]
    param([object]$NotExpected, [object]$Actual, [string]$Message)

    Write-Verbose "Asserting are not equal. Expected: '$NotExpected' ; Actual: '$Actual'."
    if (Test-AreEqual $NotExpected $Actual) {
        throw ("Assert are not equal failed. Not expected: '$NotExpected' ; Actual: '$Actual'. $Message".Trim())
    }
}

function Assert-TaskIssueMessagesAreEqual {
    [CmdletBinding()]
    param([string]$Expected, [string]$Actual, [string]$Message)

    Write-Verbose "Asserting Task issue messages are equal. Expected: '$Expected' ; Actual: '$Actual'."
    if ($Expected -ne $Actual) {
        throw ("Assert are equal failed. Expected: '$Expected' ; Actual: '$Actual'. $Message".Trim())
    }
}

function Assert-IsGreaterThan {
    [CmdletBinding()]
    param([object]$Expected, [object]$Actual, [string]$Message)

    Write-Verbose "Asserting is greater than. Expected greater than: '$Expected' ; Actual: '$Actual'."
    if (!($Actual -gt $Expected)) {
        throw ("Assert is greater than failed. Expected to be greater than: '$Expected' ; Actual: '$Actual'. $Message".Trim())
    }
}

function Assert-IsNotNullOrEmpty {
    [CmdletBinding()]
    param([object]$Actual, [string]$Message)

    Write-Verbose "Asserting is not null or empty."
    if (!$Actual) {
        $OFS = " "
        throw ("Assert is not null or empty failed. Actual: '$Actual'. $Message".Trim())
    }
}

function Assert-IsNullOrEmpty {
    [CmdletBinding()]
    param([object]$Actual, [string]$Message)

    Write-Verbose "Asserting is null or empty."
    if ($Actual) {
        $OFS = " "
        throw ("Assert is null or empty failed. Actual: '$Actual'. $Message".Trim())
    }
}

function Assert-Throws {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$ScriptBlock,
        [string]$MessagePattern)

    Write-Verbose "Asserting script block should throw: {$ScriptBlock}"
    $didThrow = $false
    try {
        & $ScriptBlock
    } catch {
        $message = $_.Exception.Message
        if ($MessagePattern -and $message -notlike $MessagePattern) {
            throw "Actual exception message does not match expected pattern. Expected: $MessagePattern ; Actual: $message"
        } elseif ($MessagePattern) {
            Write-Verbose "Success. Matched exception message. Pattern: $MessagePattern ; Message: $message"
        } else {
            Write-Verbose "Success. Caught exception: $message"
        }

        $didThrow = $true
    }

    if (!$didThrow) {
        throw "Expected script block to throw."
    }
}

function Assert-WasCalled {
    [CmdletBinding(DefaultParameterSetName = "ParametersEvaluator")]
    param(
        [Parameter(Mandatory = $true, Position = 1)]
        [string]$Command,
        [int]$Times = -1,
        [Parameter(ParameterSetName = "ParametersEvaluator")]
        [scriptblock]$ParametersEvaluator,
        [Parameter(ParameterSetName = "ArgumentsEvaluator")]
        [scriptblock]$ArgumentsEvaluator,
        [Parameter(ParameterSetName = "Arguments", Position = 2, ValueFromRemainingArguments = $true)]
        [object[]]$Arguments)

    if ($PSCmdlet.ParameterSetName -eq 'Arguments' -and ([object]::ReferenceEquals($Arguments, $null))) {
        throw "Arguments cannot be null. Specify an empty array instead or use a different parameter set."
    }

    # Verbose logging.
    Write-Verbose "Asserting was-called: $Command"
    $expectedTimesDescription = if ($Times -lt 0) { "At least once" } else { $Times }
    Write-Verbose "  Expected times: $expectedTimesDescription"
    if (!([object]::ReferenceEquals($Arguments, $null))) {
        $OFS = " "
        Write-Verbose "  Expected arguments: $Arguments"
    } elseif ($ParametersEvaluator) {
        Write-Verbose "  Parameters evaluator: { $($ParametersEvaluator.ToString().Trim()) }"
    } elseif ($ArgumentsEvaluator) {
        Write-Verbose "  Arguments evaluator: { $($ArgumentsEvaluator.ToString().Trim()) }"
    }

    # Get the mock.
    if (!($mock = $script:mocks[$Command])) {
        throw "Mock not found for command: $Command"
    }

    # Count matching invocations.
    $actualTimes = 0
    foreach ($invocation in $mock.Invocations) {
        if (Test-Invocation -Invocation $invocation -ParametersEvaluator $ParametersEvaluator -ArgumentsEvaluator $ArgumentsEvaluator -Arguments $Arguments) {
            $actualTimes++
        }
    }

    # Throw if number of times invoked does not match the expectation.
    Write-Verbose "  Actual times: $actualTimes"
    if (($Times -lt 0 -and $actualTimes -eq 0) -or ($Times -ge 0 -and $Times -ne $actualTimes)) {
        Trace-Invocations -Mock $mock
        $message = "Assert was-called failed. Expected times: $expectedTimesDescription ; Actual times: $actualTimes ; Command: $Command"
        if ($ParametersEvaluator) {
            throw "$message ; ParametersEvaluator: { $($ParametersEvaluator.ToString().Trim()) }"
        } elseif ($ArgumentsEvaluator) {
            throw "$message ; ArgumentsEvaluator: { $($ArgumentsEvaluator.ToString().Trim()) }"
        } elseif (!([object]::ReferenceEquals($Arguments, $null))) {
            $OFS = " "
            throw "$message ; Arguments: $Arguments"
        } else {
            throw $message
        }
    }
}

function Register-Mock {
    [CmdletBinding(DefaultParameterSetName = "ParametersEvaluator")]
    param(
        [Parameter(Mandatory = $true, Position = 1)]
        [string]$Command,
        [Parameter(Position = 2)]
        [scriptblock]$Func,
        [Parameter(ParameterSetName = "ParametersEvaluator")]
        [scriptblock]$ParametersEvaluator,
        [Parameter(ParameterSetName = 'ArgumentsEvaluator')]
        [scriptblock]$ArgumentsEvaluator,
        [Parameter(ParameterSetName = 'Arguments', Position = 3, ValueFromRemainingArguments = $true)]
        [object[]]$Arguments)

    if ($PSCmdlet.ParameterSetName -eq 'Arguments' -and ([object]::ReferenceEquals($Arguments, $null))) {
        throw "Arguments cannot be null. Specify an empty array instead or use a different parameter set."
    }

    # Check if the command is already registered.
    if (!($mock = $script:mocks[$Command])) {
        # Create the mock.
        $functionName = "$($Command)_$([guid]::NewGuid().ToString().GetHashCode())"
        $script:mocks[$Command] = New-Object -TypeName psobject -Property @{
            'Command' = $Command
            'Implementations' = @( )
            'Invocations' = @( )
            'GlobalAlias' = New-Alias -Name $Command -Value "global:$functionName" -Scope global -PassThru
            'GlobalFunction' = New-Item -Force -Path "function:\global:$functionName" -Value {
                param()

                # Lookup the mock.
                $commandName = $MyInvocation.MyCommand.Name.Substring(0, $MyInvocation.MyCommand.Name.LastIndexOf('_'))
                Write-Verbose "Invoking mock command: $commandName"
                $OFS = " "
                Write-Verbose "  Arguments: $args"
                $mock = $script:mocks[$commandName];
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
        $mock = $script:mocks[$Command]
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

function Unregister-Mock {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Command)

    $mock = $script:mocks[$Command]
    if ($mock) {
        Remove-Item -LiteralPath "alias:\$($mock.GlobalAlias.Name)"
        Remove-Item -LiteralPath $mock.GlobalFunction.PSPath
        $script:mocks.Remove($Command)
    }
}