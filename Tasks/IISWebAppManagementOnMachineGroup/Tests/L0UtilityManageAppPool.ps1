[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockHelpers.ps1

. $PSScriptRoot\..\Utility.ps1

$actionIISApplicationPool = "CreateOrUpdateAppPool"
$appPoolName = "Sample App Pool"
$startStopRecycleAppPoolName = ""
$dotNetVersion = "v4.0"
$pipeLineMode = "Classic"
$appPoolIdentity = "ApplicationPoolIdentity"
$appPoolUsername = ""
$appPoolPassword = ""
$appCmdCommands = ""

# Test 1 

Register-Mock Invoke-Main { }

Set-IISApplicationPool -actionIISApplicationPool $actionIISApplicationPool -appPoolName $appPoolName -startStopRecycleAppPoolName $startStopRecycleAppPoolName -dotNetVersion $dotNetVersion `
    -pipeLineMode $pipeLineMode -appPoolIdentity $appPoolIdentity -appPoolUsername $appPoolUsername -appPoolPassword $appPoolPassword -appCmdCommands $appCmdCommands

Assert-WasCalled Invoke-Main -Times 1
Assert-WasCalled Invoke-Main -- -ActionIISApplicationPool "CreateOrUpdateAppPool" -AppPoolName "Sample App Pool" -DotNetVersion "v4.0" -PipeLineMode "Classic" -AppPoolIdentity "ApplicationPoolIdentity" -AppPoolCredentials $null -AppCmdCommands ""

# Test 2 

$appPoolIdentity = "SpecificUser"

Unregister-Mock Invoke-Main 

Register-Mock Invoke-Main { }
Register-Mock Get-CustomCredentials { return "CustomCredentialsObject" }

Set-IISApplicationPool -actionIISApplicationPool $actionIISApplicationPool -appPoolName $appPoolName -startStopRecycleAppPoolName $startStopRecycleAppPoolName -dotNetVersion $dotNetVersion `
    -pipeLineMode $pipeLineMode -appPoolIdentity $appPoolIdentity -appPoolUsername $appPoolUsername -appPoolPassword $appPoolPassword -appCmdCommands $appCmdCommands

Assert-WasCalled Invoke-Main -Times 1
Assert-WasCalled Invoke-Main -- -ActionIISApplicationPool "CreateOrUpdateAppPool" -AppPoolName "Sample App Pool" -DotNetVersion "v4.0" -PipeLineMode "Classic" -AppPoolIdentity "SpecificUser" -AppPoolCredentials "CustomCredentialsObject" -AppCmdCommands ""

# Test 3 

$actionIISApplicationPool = "StartAppPool"
$startStopRecycleAppPoolName = "Sample App Pool"

Unregister-Mock Invoke-Main 
Register-Mock Invoke-Main { }

Set-IISApplicationPool -actionIISApplicationPool $actionIISApplicationPool -appPoolName $appPoolName -startStopRecycleAppPoolName $startStopRecycleAppPoolName -dotNetVersion $dotNetVersion `
    -pipeLineMode $pipeLineMode -appPoolIdentity $appPoolIdentity -appPoolUsername $appPoolUsername -appPoolPassword $appPoolPassword -appCmdCommands $appCmdCommands

Assert-WasCalled Invoke-Main -Times 1
Assert-WasCalled Invoke-Main -- -ActionIISApplicationPool "StartAppPool" -AppPoolName "Sample App Pool" -AppCmdCommands ""

# Test 4 

$actionIISApplicationPool = "StopAppPool"
$startStopRecycleAppPoolName = "Sample App Pool"

Unregister-Mock Invoke-Main 
Register-Mock Invoke-Main { }

Set-IISApplicationPool -actionIISApplicationPool $actionIISApplicationPool -appPoolName $appPoolName -startStopRecycleAppPoolName $startStopRecycleAppPoolName -dotNetVersion $dotNetVersion `
    -pipeLineMode $pipeLineMode -appPoolIdentity $appPoolIdentity -appPoolUsername $appPoolUsername -appPoolPassword $appPoolPassword -appCmdCommands $appCmdCommands

Assert-WasCalled Invoke-Main -Times 1
Assert-WasCalled Invoke-Main -- -ActionIISApplicationPool "StopAppPool" -AppPoolName "Sample App Pool" -AppCmdCommands ""

# Test 5 

$actionIISApplicationPool = "RecycleAppPool"
$startStopRecycleAppPoolName = "Sample App Pool"

Unregister-Mock Invoke-Main 
Register-Mock Invoke-Main { }

Set-IISApplicationPool -actionIISApplicationPool $actionIISApplicationPool -appPoolName $appPoolName -startStopRecycleAppPoolName $startStopRecycleAppPoolName -dotNetVersion $dotNetVersion `
    -pipeLineMode $pipeLineMode -appPoolIdentity $appPoolIdentity -appPoolUsername $appPoolUsername -appPoolPassword $appPoolPassword -appCmdCommands $appCmdCommands

Assert-WasCalled Invoke-Main -Times 1
Assert-WasCalled Invoke-Main -- -ActionIISApplicationPool "RecycleAppPool" -AppPoolName "Sample App Pool" -AppCmdCommands ""

# Test 6

$actionIISApplicationPool = "InvalidOption"

Assert-Throws {
    Set-IISApplicationPool -actionIISApplicationPool $actionIISApplicationPool -appPoolName $appPoolName -startStopRecycleAppPoolName $startStopRecycleAppPoolName -dotNetVersion $dotNetVersion `
        -pipeLineMode $pipeLineMode -appPoolIdentity $appPoolIdentity -appPoolUsername $appPoolUsername -appPoolPassword $appPoolPassword -appCmdCommands $appCmdCommands
} -MessagePattern "InvalidActionIISAppPool InvalidOption"