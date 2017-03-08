[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockHelpers.ps1

. $PSScriptRoot\..\ps_modules\TaskModuleIISManageUtility\AppCmdOnTargetMachines.ps1

$siteName = "Sample Web Site"
$appPoolName = ""
$physicalPath = "Drive:/RandomPath"
$authType = "WebsiteUserPassThrough"
$websitePhysicalPathAuthCredentials = $null
$addBinding = "false"
$protocol = "http"
$ipAddress = "All Unassigned"
$port = "8080"
$hostname = $null

# Test 1 : Website exists and without add binding input

Register-Mock Test-WebsiteExist { return $true }
Register-Mock Test-Path { return $true } 
Register-Mock Invoke-VstsTool { } 

Add-And-Update-Website -siteName $siteName -appPoolName $appPoolName -physicalPath $physicalPath -authType $authType `
                -websitePhysicalPathAuthCredentials $websitePhysicalPathAuthCredentials -addBinding $addBinding -protocol $protocol `
                -ipAddress $ipAddress -port $port -hostname $hostname                

Assert-WasCalled Test-WebsiteExist -Times 1
Assert-WasCalled Invoke-VstsTool -Times 1

# Test 2 : Website does not exist and add binding input is enabled and binding does not exist for any site

$addBinding = "true"

Unregister-Mock Test-WebsiteExist
Unregister-Mock Invoke-VstsTool

Register-Mock Test-WebsiteExist { return $false }
Register-Mock Test-BindingExist { return $false }
Register-Mock Invoke-VstsTool { }

Add-And-Update-Website -siteName $siteName -appPoolName $appPoolName -physicalPath $physicalPath -authType $authType `
                -websitePhysicalPathAuthCredentials $websitePhysicalPathAuthCredentials -addBinding $addBinding -protocol $protocol `
                -ipAddress $ipAddress -port $port -hostname $hostname                


Assert-WasCalled Test-WebsiteExist -Times 1
Assert-WasCalled Test-BindingExist -Times 1
Assert-WasCalled Invoke-VstsTool -Times 2
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " add site /name:`"Sample Web Site`" /physicalPath:`"Drive:/RandomPath`""  -RequireExitCodeZero
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " set site /site.name:`"Sample Web Site`" -[path='/'].[path='/'].physicalPath:`"Drive:/RandomPath`" -[path='/'].[path='/'].userName: -[path='/'].[path='/'].password: /+bindings.[protocol='http',bindingInformation='*:8080:']" -RequireExitCodeZero

# Test 3 : Website exists and update app pool is enabled and binding already exists for the current site 

$appPoolName = "Sample App Pool"
$addBinding = "true"

Unregister-Mock Test-WebsiteExist
Unregister-Mock Test-BindingExist 
Unregister-Mock Invoke-VstsTool

Register-Mock Test-WebsiteExist { return $true }
Register-Mock Test-BindingExist { return $true }
Register-Mock Invoke-VstsTool { }

Add-And-Update-Website -siteName $siteName -appPoolName $appPoolName -physicalPath $physicalPath -authType $authType `
                -websitePhysicalPathAuthCredentials $websitePhysicalPathAuthCredentials -addBinding $addBinding -protocol $protocol `
                -ipAddress $ipAddress -port $port -hostname $hostname        

Assert-WasCalled Test-WebsiteExist -Times 1
Assert-WasCalled Test-BindingExist -Times 1
Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " set site /site.name:`"Sample Web Site`" -applicationDefaults.applicationPool:`"Sample App Pool`" -[path='/'].[path='/'].physicalPath:`"Drive:/RandomPath`" -[path='/'].[path='/'].userName: -[path='/'].[path='/'].password:" -RequireExitCodeZero

# Test 4 : Add binding with specific ip address and hostname

$appPoolName = ""
$addBinding = "true"
$ipAddress = "127.0.0.1"
$hostname = "somehost"

Unregister-Mock Test-WebsiteExist
Unregister-Mock Test-BindingExist 
Unregister-Mock Invoke-VstsTool

Register-Mock Test-WebsiteExist { return $true }
Register-Mock Test-BindingExist { return $false }
Register-Mock Invoke-VstsTool { }

Add-And-Update-Website -siteName $siteName -appPoolName $appPoolName -physicalPath $physicalPath -authType $authType `
                -websitePhysicalPathAuthCredentials $websitePhysicalPathAuthCredentials -addBinding $addBinding -protocol $protocol `
                -ipAddress $ipAddress -port $port -hostname $hostname        

Assert-WasCalled Test-WebsiteExist -Times 1
Assert-WasCalled Test-BindingExist -Times 1
Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " set site /site.name:`"Sample Web Site`" -[path='/'].[path='/'].physicalPath:`"Drive:/RandomPath`" -[path='/'].[path='/'].userName: -[path='/'].[path='/'].password: /+bindings.[protocol='http',bindingInformation='127.0.0.1:8080:somehost']" -RequireExitCodeZero

# Test 5 : Physical path authentication input is enabled

$authType = "WebsiteWindowsAuth"
$websitePhysicalPathAuthCredentials = Get-MockCredentials

Unregister-Mock Test-WebsiteExist
Unregister-Mock Test-BindingExist 
Unregister-Mock Invoke-VstsTool

Register-Mock Test-WebsiteExist { return $true }
Register-Mock Test-BindingExist { return $true }
Register-Mock Invoke-VstsTool { }

Add-And-Update-Website -siteName $siteName -appPoolName $appPoolName -physicalPath $physicalPath -authType $authType `
                -websitePhysicalPathAuthCredentials $websitePhysicalPathAuthCredentials -addBinding $addBinding -protocol $protocol `
                -ipAddress $ipAddress -port $port -hostname $hostname        

Assert-WasCalled Test-WebsiteExist -Times 1
Assert-WasCalled Test-BindingExist -Times 1
Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " set site /site.name:`"Sample Web Site`" -[path='/'].[path='/'].physicalPath:`"Drive:/RandomPath`" -[path='/'].[path='/'].userName:`"domain\name`" -[path='/'].[path='/'].password:`"random!123```"`$password`"" -RequireExitCodeZero
