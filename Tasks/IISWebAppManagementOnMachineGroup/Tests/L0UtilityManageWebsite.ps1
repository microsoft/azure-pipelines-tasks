[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockHelpers.ps1

. $PSScriptRoot\..\Utility.ps1

$actionIISWebsite = "CreateOrUpdateWebsite"
$websiteName = "Sample Web Site"
$startStopWebsiteName = ""
$websitePhysicalPath = "Drive:\Physical Path"
$websitePhysicalPathAuth = "WebsiteUserPassThrough"
$websiteAuthUserName = ""
$websiteAuthUserPassword = ""
$addBinding = "true"
$bindings = "bindingsString"
$createOrUpdateAppPoolForWebsite = "false"
$appPoolNameForWebsite = "Sample App Pool"
$dotNetVersionForWebsite = "v4.0"
$pipeLineModeForWebsite = "Integrated"
$appPoolIdentityForWebsite = "ApplicationPoolIdentity"
$appPoolUsernameForWebsite = ""
$appPoolPasswordForWebsite = ""
$configureAuthenticationForWebsite = "true"
$anonymousAuthenticationForWebsite = "false"
$basicAuthenticationForWebsite = "true"
$windowsAuthenticationForWebsite = "true"
$appCmdCommands = ""

# Test 1

Register-Mock Invoke-Main { }
Register-Mock Validate-Bindings { return "bindingsArray" }

Set-IISWebsite -actionIISWebsite $actionIISWebsite -websiteName $websiteName -startStopWebsiteName $startStopWebsiteName -physicalPath $websitePhysicalPath -physicalPathAuth $websitePhysicalPathAuth -physicalPathAuthUserName $websiteAuthUserName -physicalPathAuthUserPassword $websiteAuthUserPassword `
    -addBinding $addBinding -bindings $bindings `
    -createOrUpdateAppPool $createOrUpdateAppPoolForWebsite -appPoolName $appPoolNameForWebsite -dotNetVersion $dotNetVersionForWebsite -pipeLineMode $pipeLineModeForWebsite -appPoolIdentity $appPoolIdentityForWebsite -appPoolUsername $appPoolUsernameForWebsite -appPoolPassword $appPoolPasswordForWebsite `
    -configureAuthentication $configureAuthenticationForWebsite -anonymousAuthentication $anonymousAuthenticationForWebsite -basicAuthentication $basicAuthenticationForWebsite -windowsAuthentication $windowsAuthenticationForWebsite -appCmdCommands $appCmdCommands

Assert-WasCalled Invoke-Main -Times 1
Assert-WasCalled Invoke-Main -- -ActionIISWebsite "CreateOrUpdateWebsite" -WebsiteName "Sample Web Site" -PhysicalPath "Drive:\Physical Path" -PhysicalPathAuth "WebsiteUserPassThrough" -PhysicalPathAuthCredentials "" -AddBinding "true" -bindings "bindingsArray" -configureAuthentication "true" -anonymousAuthentication "false" -basicAuthentication "true" -windowsAuthentication "true" -AppCmdCommands "" 

#Test 2 

$createOrUpdateAppPoolForWebsite = "true"
$websitePhysicalPathAuth = "WebsiteWindowsAuth"
$websiteAuthUserName = "name"
$websiteAuthUserPassword = "pass"

$appPoolIdentityForWebsite = "SpecificUser"
$appPoolUsernameForWebsite = "name"
$appPoolPasswordForWebsite = "pass"

Unregister-Mock Invoke-Main 
Register-Mock Invoke-Main { }

Register-Mock Get-CustomCredentials { return "CustomCredentialsObject" }

Set-IISWebsite -actionIISWebsite $actionIISWebsite -websiteName $websiteName -startStopWebsiteName $startStopWebsiteName -physicalPath $websitePhysicalPath -physicalPathAuth $websitePhysicalPathAuth -physicalPathAuthUserName $websiteAuthUserName -physicalPathAuthUserPassword $websiteAuthUserPassword `
    -addBinding $addBinding -bindings $bindings `
    -createOrUpdateAppPool $createOrUpdateAppPoolForWebsite -appPoolName $appPoolNameForWebsite -dotNetVersion $dotNetVersionForWebsite -pipeLineMode $pipeLineModeForWebsite -appPoolIdentity $appPoolIdentityForWebsite -appPoolUsername $appPoolUsernameForWebsite -appPoolPassword $appPoolPasswordForWebsite `
    -configureAuthentication $configureAuthenticationForWebsite -anonymousAuthentication $anonymousAuthenticationForWebsite -basicAuthentication $basicAuthenticationForWebsite -windowsAuthentication $windowsAuthenticationForWebsite -appCmdCommands $appCmdCommands

Assert-WasCalled Invoke-Main -Times 1
Assert-WasCalled Get-CustomCredentials -Times 2
Assert-WasCalled Invoke-Main -- -ActionIISWebsite "CreateOrUpdateWebsite" -WebsiteName "Sample Web Site" -PhysicalPath "Drive:\Physical Path" -PhysicalPathAuth "WebsiteWindowsAuth" -PhysicalPathAuthCredentials "CustomCredentialsObject" -AddBinding "true" -bindings "bindingsArray" -ActionIISApplicationPool "CreateOrUpdateAppPool" -AppPoolName "Sample App Pool" -DotNetVersion "v4.0" -PipeLineMode "Integrated" -AppPoolIdentity "SpecificUser" -AppPoolCredentials "CustomCredentialsObject" -configureAuthentication "true" -anonymousAuthentication "false" -basicAuthentication "true" -windowsAuthentication "true" -AppCmdCommands "" 

# Test 3

$actionIISWebsite = "StartWebsite"
$startStopWebsiteName = "Sample Web Site"

Unregister-Mock Invoke-Main 
Register-Mock Invoke-Main { }

Set-IISWebsite -actionIISWebsite $actionIISWebsite -websiteName $websiteName -startStopWebsiteName $startStopWebsiteName -physicalPath $websitePhysicalPath -physicalPathAuth $websitePhysicalPathAuth -physicalPathAuthUserName $websiteAuthUserName -physicalPathAuthUserPassword $websiteAuthUserPassword `
    -addBinding $addBinding -bindings $bindings `
    -createOrUpdateAppPool $createOrUpdateAppPoolForWebsite -appPoolName $appPoolNameForWebsite -dotNetVersion $dotNetVersionForWebsite -pipeLineMode $pipeLineModeForWebsite -appPoolIdentity $appPoolIdentityForWebsite -appPoolUsername $appPoolUsernameForWebsite -appPoolPassword $appPoolPasswordForWebsite `
    -appCmdCommands $appCmdCommands

Assert-WasCalled Invoke-Main -Times 1
Assert-WasCalled Invoke-Main -- -ActionIISWebsite "StartWebsite" -WebsiteName "Sample Web Site" -AppCmdCommands ""

# Test 4

$actionIISWebsite = "StopWebsite"
$startStopWebsiteName = "Sample Web Site"

Unregister-Mock Invoke-Main 
Register-Mock Invoke-Main { }

Set-IISWebsite -actionIISWebsite $actionIISWebsite -websiteName $websiteName -startStopWebsiteName $startStopWebsiteName -physicalPath $websitePhysicalPath -physicalPathAuth $websitePhysicalPathAuth -physicalPathAuthUserName $websiteAuthUserName -physicalPathAuthUserPassword $websiteAuthUserPassword `
    -addBinding $addBinding -bindings $bindings `
    -createOrUpdateAppPool $createOrUpdateAppPoolForWebsite -appPoolName $appPoolNameForWebsite -dotNetVersion $dotNetVersionForWebsite -pipeLineMode $pipeLineModeForWebsite -appPoolIdentity $appPoolIdentityForWebsite -appPoolUsername $appPoolUsernameForWebsite -appPoolPassword $appPoolPasswordForWebsite `
    -appCmdCommands $appCmdCommands

Assert-WasCalled Invoke-Main -Times 1
Assert-WasCalled Invoke-Main -- -ActionIISWebsite "StopWebsite" -WebsiteName "Sample Web Site" -AppCmdCommands ""

# Test 5

$actionIISWebsite = "InvalidOption"

Assert-Throws {
    Set-IISWebsite -actionIISWebsite $actionIISWebsite -websiteName $websiteName -startStopWebsiteName $startStopWebsiteName -physicalPath $websitePhysicalPath -physicalPathAuth $websitePhysicalPathAuth -physicalPathAuthUserName $websiteAuthUserName -physicalPathAuthUserPassword $websiteAuthUserPassword `
        -addBinding $addBinding -bindings $bindings `
        -createOrUpdateAppPool $createOrUpdateAppPoolForWebsite -appPoolName $appPoolNameForWebsite -dotNetVersion $dotNetVersionForWebsite -pipeLineMode $pipeLineModeForWebsite -appPoolIdentity $appPoolIdentityForWebsite -appPoolUsername $appPoolUsernameForWebsite -appPoolPassword $appPoolPasswordForWebsite `
        -configureAuthentication $configureAuthenticationForWebsite -anonymousAuthentication $anonymousAuthenticationForWebsite -basicAuthentication $basicAuthenticationForWebsite -windowsAuthentication $windowsAuthenticationForWebsite -appCmdCommands $appCmdCommands
} -MessagePattern "InvalidActionIISWebsite InvalidOption" 