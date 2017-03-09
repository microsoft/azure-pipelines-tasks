[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockHelpers.ps1

. $PSScriptRoot\..\ps_modules\TaskModuleIISManageUtility\AppCmdOnTargetMachines.ps1

$websiteName = "Sample Web Site"
$virtualPath = "/Application"
$physicalPath = "Drive:/Physical Path"
$appPoolName = ""
$physicalPathAuth = "ApplicationUserPassThrough"
$physicalPathAuthCredentials = $null

Register-Mock Test-Path { return $true } -ParametersEvaluator { $Path -eq $physicalPath }

# Test 1 : Application doesn't exist 

Register-Mock Test-ApplicationExist { return $false }
Register-Mock Invoke-VstsTool { }

Add-And-Update-Application -siteName $websiteName -virtualPath $virtualPath -physicalPath $physicalPath -applicationPool $appPoolName -physicalPathAuthentication $physicalPathAuth -physicalPathAuthenticationCredentials $physicalPathAuthCredentials

Assert-WasCalled Test-ApplicationExist -Times 1
Assert-WasCalled Invoke-VstsTool -Times 2
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " add app /site.name:`"Sample Web Site`" /path:`"/Application`" /physicalPath:`"Drive:/Physical Path`"" -RequireExitCodeZero
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " set app /app.name:`"Sample Web Site/Application`" -[path='/'].physicalPath:`"Drive:/Physical Path`" -[path='/'].userName: -[path='/'].password:" -RequireExitCodeZero

# Test 2 : Application Exists. Updating properties 

$physicalPath = "Drive:/New Physical Path"
$appPoolName = "Sample App Pool"

Unregister-Mock Test-ApplicationExist
Unregister-Mock Invoke-VstsTool

Register-Mock Test-ApplicationExist { return $true }
Register-Mock Invoke-VstsTool { }

Add-And-Update-Application -siteName $websiteName -virtualPath $virtualPath -physicalPath $physicalPath -applicationPool $appPoolName -physicalPathAuthentication $physicalPathAuth -physicalPathAuthenticationCredentials $physicalPathAuthCredentials

Assert-WasCalled Test-ApplicationExist -Times 1
Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " set app /app.name:`"Sample Web Site/Application`" -applicationPool:`"Sample App Pool`" -[path='/'].physicalPath:`"Drive:/New Physical Path`" -[path='/'].userName: -[path='/'].password:" -RequireExitCodeZero

# Test 3 : Updating the application's physical path authentication

$physicalPathAuth = "ApplicationWindowsAuth"
$physicalPathAuthCredentials = Get-MockCredentials

Unregister-Mock Test-ApplicationExist
Unregister-Mock Invoke-VstsTool

Register-Mock Test-ApplicationExist { return $true }
Register-Mock Invoke-VstsTool { }

Add-And-Update-Application -siteName $websiteName -virtualPath $virtualPath -physicalPath $physicalPath -applicationPool $appPoolName -physicalPathAuthentication $physicalPathAuth -physicalPathAuthenticationCredentials $physicalPathAuthCredentials

Assert-WasCalled Test-ApplicationExist -Times 1
Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " set app /app.name:`"Sample Web Site/Application`" -applicationPool:`"Sample App Pool`" -[path='/'].physicalPath:`"Drive:/New Physical Path`" -[path='/'].userName:`"domain\name`" -[path='/'].password:`"random!123```"`$password`"" -RequireExitCodeZero
