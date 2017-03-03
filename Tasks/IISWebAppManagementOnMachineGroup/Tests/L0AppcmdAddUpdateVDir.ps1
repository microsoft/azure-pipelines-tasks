[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockHelpers.ps1

. $PSScriptRoot\..\ps_modules\TaskModuleIISManageUtility\AppCmdOnTargetMachines.ps1

$websiteName = "Sample Web Site"
$virtualPath = "/Applcation/VDir"
$physicalPath = "Drive:/Physical Path"
$physicalPathAuth = "VDUserPassThrough"
$physicalPathAuthCredentials = $null

Register-Mock Test-Path { return $true } -ParametersEvaluator { $Path -eq $physicalPath }

#Test 1 : Virtual Directory doesn't exist. Create new 

Register-Mock Test-VirtualDirectoryExist { return $false }
Register-Mock Invoke-VstsTool { }

Add-And-Update-VirtualDirectory -siteName $websiteName -virtualPath $virtualPath -physicalPath $physicalPath -physicalPathAuthentication $physicalPathAuth -physicalPathAuthenticationCredentials $physicalPathAuthCredentials

Assert-WasCalled Test-VirtualDirectoryExist -Times 1
Assert-WasCalled Invoke-VstsTool -Times 2
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " add vdir /app.name:`"Sample Web Site/Applcation`" /path:`"/VDir`" /physicalPath:`"Drive:/Physical Path`"" -RequireExitCodeZero
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " set vdir /vdir.name:`"Sample Web Site/Applcation/VDir`" -physicalPath:`"Drive:/Physical Path`" -userName: -password:" -RequireExitCodeZero

# Test 2 : Virtual Directory exists. Updating 

$physicalPathAuth = "VDWindowsAuth"
$physicalPathAuthCredentials = Get-MockCredentials

Unregister-Mock Test-VirtualDirectoryExist
Unregister-Mock Invoke-VstsTool

Register-Mock Test-VirtualDirectoryExist { return $true }
Register-Mock Invoke-VstsTool { }

Add-And-Update-VirtualDirectory -siteName $websiteName -virtualPath $virtualPath -physicalPath $physicalPath -physicalPathAuthentication $physicalPathAuth -physicalPathAuthenticationCredentials $physicalPathAuthCredentials

Assert-WasCalled Test-VirtualDirectoryExist -Times 1
Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " set vdir /vdir.name:`"Sample Web Site/Applcation/VDir`" -physicalPath:`"Drive:/Physical Path`" -userName:`"domain\name`" -password:`"random!123```"`$password`"" -RequireExitCodeZero
