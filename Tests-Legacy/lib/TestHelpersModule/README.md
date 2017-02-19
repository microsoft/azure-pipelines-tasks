# Assert Helpers

## Assert-AreEqual
 * Recursively unravels objects and compares the elements. At each stage of the recursive walk, if the unraveled count does not match, the assertion will fail.
 * Treats empty string and null as a match.
 * Takes a strict-ish approach when comparing elements. Compares objects both directions using the -eq operator. This alleviates false positives due to casting issues.

Parameters:
 * [object]$Expected (positional)
 * [object]$Actual (positional)
 * [string]$Message (optional ; positional)

## Assert-AreNotEqual
 * Similar to ```Assert-AreEqual```

Parameters:
 * [object]$NotExpected (positional)
 * [object]$Actual (positional)
 * [string]$Message (optional ; positional)

## Assert-IsGreaterThan
Parameters:
 * [object]$Expected (positional)
 * [object]$Actual (positional)
 * [string]$Message (optional ; positional)

## Assert-IsNotNullOrEmpty
Parameters:
 * [object]$Actual (positional)
 * [string]$Message (optional ; positional)

## Assert-IsNullOrEmpty
Parameters:
 * [object]$Actual (positional)
 * [string]$Message (optional ; positional)

## Assert-Throws
Parameters:
 * [scriptblock]$ScriptBlock (positional)
 * [string]$MessagePattern (optional ; positional ; wildcard pattern to validate against the caught exception message)

# Mock Helpers

## Register-Mock

### Using an Arguments Array
Parameters:
 * [string]$Command (positional)
 * [scriptblock]$Func (optional ; positional)
 * [object[]]$Arguments (optional ; positional ; value from remaining arguments)

Examples:

```PowerShell
Register-Mock Get-Foo
Register-Mock Get-Foo { 'Some return value' }
Register-Mock Get-Foo { 'Some return value' } -- -SomeParameter 'Some parameter value'
Register-Mock Get-Foo -Arguments @( '-SomeParameter', 'Some parameter value' )
```

### Using a Parameters Evaluator
Parameters:
 * [string]$Command (positional)
 * [scriptblock]$Func (optional ; positional)
 * [scriptblock]$ParametersEvaluator (exposes parameters as variables for complex matching logic)

Examples:
```PowerShell
Register-Mock Get-Foo { 'Some return value' } -ParametersEvaluator { $SomeParameter -like '*SomeValue*' }
Register-Mock Get-Foo -ParametersEvaluator { $SomeParameter -like '*SomeValue*' }
```

### Using an Arguments Evaluator
Parameters:
 * [string]$Command (positional)
 * [scriptblock]$Func (optional ; positional)
 * [scriptblock]$ArgumentsEvaluator (exposes args as a variable for complex matching logic)

Examples:
```PowerShell
Register-Mock Get-Foo { 'return val' } -ArgumentsEvaluator { $args.count -eq 1 -and $args[0] -like '*SomeValue*' }
Register-Mock Get-Foo -ArgumentsEvaluator { $args.count -eq 1 -and $args[0] -like '*SomeValue*' }
```

## Assert-WasCalled

### Using an Arguments Array
Parameters:
 * [string]$Command (positional)
 * [int]$Times (optional ; defaults to -1 which indicates at least once ; specify zero or greater for an exact match)
 * [object[]]$Arguments (optional ; positional ; value from remaining arguments)

Examples:

```PowerShell
Assert-WasCalled Get-Foo -Times 0
Assert-WasCalled Get-Foo -- -SomeParameter 'Some parameter value'
Assert-WasCalled Get-Foo -- -SomeSwitch: $true
Assert-WasCalled Get-Foo -- -SomeSwitch
Assert-WasCalled Get-Foo -Arguments @( '-SomeParameter', 'Some parameter value' )
```
### Using a Parameters Evaluator
Parameters:
 * [string]$Command (positional)
 * [int]$Times (optional ; defaults to -1 which indicates at least once ; specify zero or greater for an exact match)
 * [scriptblock]$ParametersEvaluator (exposes parameters as variables for complex matching logic)

Examples:
```PowerShell
Assert-WasCalled Get-Foo -ParametersEvaluator { $SomeParameter -like '*SomeValue*' }
```

### Using an Arguments Evaluator
Parameters:
 * [string]$Command (positional)
 * [int]$Times (optional ; defaults to -1 which indicates at least once ; specify zero or greater for an exact match)
 * [scriptblock]$ArgumentsEvaluator (exposes args as a variable for complex matching logic)

Examples:
```PowerShell
Assert-WasCalled Get-Foo -ArgumentsEvaluator { $args.count -eq 1 -and $args[0] -like '*SomeValue*' }
```

## Unregister-Mock

Parameters
 * [string]$Command (positional)
