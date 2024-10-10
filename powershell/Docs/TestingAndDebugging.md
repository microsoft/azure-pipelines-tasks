# Testing and debugging

## Interactive testing
A task script can be tested interactively without running the agent. From PowerShell.exe run:
```PowerShell
Import-Module .\ps_modules\VstsTaskSdk
Invoke-VstsTaskScript -ScriptBlock { . .\MyTask.ps1 }
```

For PowerShell 3 and 4, a different scriptblock syntax is required:
```PowerShell
Invoke-VstsTaskScript -ScriptBlock ([scriptblock]::Create('. .\MyTask.ps1'))
```

Variables/inputs/endpoints can be passed into the script by setting environment variables before invoking your task script:
```PowerShell
# Task variable 'Build.SourcesDirectory':
$env:BUILD_SOURCESDIRECTORY = [...]

# Input 'MyInput':
$env:INPUT_MYINPUT = [...]

# Endpoint:
$env:INPUT_MYENDPOINT = 'EP1'
$env:ENDPOINT_URL_EP1 = 'https://[...]'
$env:ENDPOINT_AUTH_EP1 = '{ "Parameters": { "UserName": "Some user", "Password": "Some password" }, "Scheme": "Some scheme" }'
$env:ENDPOINT_DATA_EP1 = '{ "Key1": "Value1", "Key2": "Value2" }'
```

For the convenience of interactive testing, the module will prompt for undefined task variables and inputs. For example, `Get-VstsTaskInput -Name SomeVariable` will prompt for the value if the task variable is not defined. If a value is entered, then it will be stored so that subsequent calls will return the same value. Task variables are stored as environment variables. Inputs and endpoints are stored internally within the VstsTaskSdk module and can be cleared by removing and re-importing the module.

To disable interactive prompting, a non-interactive flag can be specified when the module is imported:
```PowerShell
Import-Module .\ps_modules\VstsTaskSdk -ArgumentList @{ NonInteractive = $true }
```

## Verbose/Debug pipelines
Messages written to the verbose pipeline (`Write-Verbose`) and debug pipeline (`Write-Debug`) are written as task debug logging commands.

However, the PowerShell preference variables still apply. When a job is queued with the `System.Debug` variable set to `True`, the agent will set the verbose preference and debug preference to `Continue` before running the script.

## Tracing for free
Many of the commands in the SDK have verbose tracing built in. By using the commands provided by the SDK, some tracing is provided for free.

## Interactive debugging
All tracing in the SDK is written to the verbose pipeline. This leaves the debug pipeline free for the task author to use for interactive debugging. For example, when interactively debugging a script, the `Debug` common parameter can be passed to effectively hit a break point on any messages written to the debug pipeline.

To view the verbose output when testing interactively:
```PowerShell
Import-Module .\ps_modules\VstsTaskSdk
Invoke-VstsTaskScript -ScriptBlock { . .\MyTask.ps1 } -Verbose
```
