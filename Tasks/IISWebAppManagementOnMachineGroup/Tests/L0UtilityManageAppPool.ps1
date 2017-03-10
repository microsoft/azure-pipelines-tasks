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

Register-Mock Execute-Main { }

Manage-IISApplicationPool -actionIISApplicationPool $actionIISApplicationPool -appPoolName $appPoolName -startStopRecycleAppPoolName $startStopRecycleAppPoolName -dotNetVersion $dotNetVersion `
    -pipeLineMode $pipeLineMode -appPoolIdentity $appPoolIdentity -appPoolUsername $appPoolUsername -appPoolPassword $appPoolPassword -appCmdCommands $appCmdCommands

Assert-WasCalled Execute-Main -Times 1
Assert-WasCalled Execute-Main -- -ActionIISApplicationPool "CreateOrUpdateAppPool" -AppPoolName "Sample App Pool" -DotNetVersion "v4.0" -PipeLineMode "Classic" -AppPoolIdentity "ApplicationPoolIdentity" -AppPoolCredentials $null -AppCmdCommands ""

# Test 2 

$appPoolIdentity = "SpecificUser"

Unregister-Mock Execute-Main 

Register-Mock Execute-Main { }
Register-Mock Get-CustomCredentials { return "CustomCredentialsObject" }

Manage-IISApplicationPool -actionIISApplicationPool $actionIISApplicationPool -appPoolName $appPoolName -startStopRecycleAppPoolName $startStopRecycleAppPoolName -dotNetVersion $dotNetVersion `
    -pipeLineMode $pipeLineMode -appPoolIdentity $appPoolIdentity -appPoolUsername $appPoolUsername -appPoolPassword $appPoolPassword -appCmdCommands $appCmdCommands

Assert-WasCalled Execute-Main -Times 1
Assert-WasCalled Execute-Main -- -ActionIISApplicationPool "CreateOrUpdateAppPool" -AppPoolName "Sample App Pool" -DotNetVersion "v4.0" -PipeLineMode "Classic" -AppPoolIdentity "SpecificUser" -AppPoolCredentials "CustomCredentialsObject" -AppCmdCommands ""

# Test 3 

$actionIISApplicationPool = "StartAppPool"
$startStopRecycleAppPoolName = "Sample App Pool"

Unregister-Mock Execute-Main 
Register-Mock Execute-Main { }

Manage-IISApplicationPool -actionIISApplicationPool $actionIISApplicationPool -appPoolName $appPoolName -startStopRecycleAppPoolName $startStopRecycleAppPoolName -dotNetVersion $dotNetVersion `
    -pipeLineMode $pipeLineMode -appPoolIdentity $appPoolIdentity -appPoolUsername $appPoolUsername -appPoolPassword $appPoolPassword -appCmdCommands $appCmdCommands

Assert-WasCalled Execute-Main -Times 1
Assert-WasCalled Execute-Main -- -ActionIISApplicationPool "StartAppPool" -AppPoolName "Sample App Pool" -AppCmdCommands ""

# Test 4 

$actionIISApplicationPool = "StopAppPool"
$startStopRecycleAppPoolName = "Sample App Pool"

Unregister-Mock Execute-Main 
Register-Mock Execute-Main { }

Manage-IISApplicationPool -actionIISApplicationPool $actionIISApplicationPool -appPoolName $appPoolName -startStopRecycleAppPoolName $startStopRecycleAppPoolName -dotNetVersion $dotNetVersion `
    -pipeLineMode $pipeLineMode -appPoolIdentity $appPoolIdentity -appPoolUsername $appPoolUsername -appPoolPassword $appPoolPassword -appCmdCommands $appCmdCommands

Assert-WasCalled Execute-Main -Times 1
Assert-WasCalled Execute-Main -- -ActionIISApplicationPool "StopAppPool" -AppPoolName "Sample App Pool" -AppCmdCommands ""

# Test 5 

$actionIISApplicationPool = "RecycleAppPool"
$startStopRecycleAppPoolName = "Sample App Pool"

Unregister-Mock Execute-Main 
Register-Mock Execute-Main { }

Manage-IISApplicationPool -actionIISApplicationPool $actionIISApplicationPool -appPoolName $appPoolName -startStopRecycleAppPoolName $startStopRecycleAppPoolName -dotNetVersion $dotNetVersion `
    -pipeLineMode $pipeLineMode -appPoolIdentity $appPoolIdentity -appPoolUsername $appPoolUsername -appPoolPassword $appPoolPassword -appCmdCommands $appCmdCommands

Assert-WasCalled Execute-Main -Times 1
Assert-WasCalled Execute-Main -- -ActionIISApplicationPool "RecycleAppPool" -AppPoolName "Sample App Pool" -AppCmdCommands ""

# Test 6

$actionIISApplicationPool = "InvalidOption"

Assert-Throws {
    Manage-IISApplicationPool -actionIISApplicationPool $actionIISApplicationPool -appPoolName $appPoolName -startStopRecycleAppPoolName $startStopRecycleAppPoolName -dotNetVersion $dotNetVersion `
        -pipeLineMode $pipeLineMode -appPoolIdentity $appPoolIdentity -appPoolUsername $appPoolUsername -appPoolPassword $appPoolPassword -appCmdCommands $appCmdCommands
} -MessagePattern "InvalidActionIISAppPool InvalidOption"