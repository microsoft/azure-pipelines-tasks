[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockHelpers.ps1

. $PSScriptRoot\..\ps_modules\TaskModuleIISManageUtility\AppCmdOnTargetMachines.ps1

$sitename = "Sample Web Site"
$appPoolName = "Sample App Pool"

# Test 1 : Start Website 

$action = "start"

Register-Mock Invoke-VstsTool { }

Start-Stop-Website -sitename $sitename -action $action

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -Filename "appcmdPath" -Arguments "start site /site.name:`"Sample Web Site`"" -RequireExitCodeZero

# Test 2 : Stop Website 

$action = "stop"

Unregister-Mock Invoke-VstsTool
Register-Mock Invoke-VstsTool { }

Start-Stop-Website -sitename $sitename -action $action

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -Filename "appcmdPath" -Arguments "stop site /site.name:`"Sample Web Site`"" -RequireExitCodeZero

# Test 3 : Start Application Pool

$action = "start"

Unregister-Mock Invoke-VstsTool
Register-Mock Invoke-VstsTool { }

Start-Stop-Recycle-ApplicationPool -appPoolName $appPoolName -action $action

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -Filename "appcmdPath" -Arguments "start apppool /apppool.name:`"Sample App Pool`"" -RequireExitCodeZero

# Test 4 : Stop Application Pool

$action = "stop"

Unregister-Mock Invoke-VstsTool
Register-Mock Invoke-VstsTool { }

Start-Stop-Recycle-ApplicationPool -appPoolName $appPoolName -action $action

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -Filename "appcmdPath" -Arguments "stop apppool /apppool.name:`"Sample App Pool`"" -RequireExitCodeZero

# Test 5 : Recycle Application Pool

$action = "recycle"

Unregister-Mock Invoke-VstsTool
Register-Mock Invoke-VstsTool { }

Start-Stop-Recycle-ApplicationPool -appPoolName $appPoolName -action $action

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -Filename "appcmdPath" -Arguments "recycle apppool /apppool.name:`"Sample App Pool`"" -RequireExitCodeZero

