[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockHelpers.ps1

. $PSScriptRoot\..\Utility.ps1

$parentWebsiteNameForApplication = "Sample Web Site"
$virtualPathForApplication = "/Application"
$physicalPathForApplication = "Drive:/Physical Path"
$applicationPhysicalPathAuth = "ApplicationUserPassThrough"
$applicationAuthUserName = ""
$applicationAuthUserPassword = ""

$createOrUpdateAppPoolForApplication = "false"
$appPoolNameForApplication = "Sample App Pool"
$dotNetVersionForApplication = "v4.0"
$pipeLineModeForApplication = "Integrated"
$appPoolIdentityForApplication = "ApplicationPoolIdentity"
$appPoolUsernameForApplication = ""
$appPoolPasswordForApplication = ""
$appCmdCommands = ""

# Test 1 

Register-Mock Execute-Main { }

Manage-IISWebApplication -parentWebsiteName $parentWebsiteNameForApplication -virtualPath $virtualPathForApplication -physicalPath $physicalPathForApplication -physicalPathAuth $applicationPhysicalPathAuth -physicalPathAuthUserName $applicationAuthUserName -physicalPathAuthUserPassword $applicationAuthUserPassword `
    -createOrUpdateAppPool $createOrUpdateAppPoolForApplication -appPoolName $appPoolNameForApplication -dotNetVersion $dotNetVersionForApplication -pipeLineMode $pipeLineModeForApplication -appPoolIdentity $appPoolIdentityForApplication -appPoolUsername $appPoolUsernameForApplication -appPoolPassword $appPoolPasswordForApplication `
    -appCmdCommands $appCmdCommands

Assert-WasCalled Execute-Main -Times 1 
Assert-WasCalled Execute-Main -- -CreateApplication "True" -WebsiteName "Sample Web Site" -VirtualPath "/Application" -PhysicalPath "Drive:/Physical Path" -PhysicalPathAuth "ApplicationUserPassThrough" -PhysicalPathAuthCredentials $null -AppCmdCommands ""

# Test 2 

$applicationPhysicalPathAuth = "ApplicationWindowsAuth"
$createOrUpdateAppPoolForApplication = "true"
$appPoolIdentityForApplication = "SpecificUser"
$appPoolUsernameForApplication = ""
$appPoolPasswordForApplication = ""

Unregister-Mock Execute-Main

Register-Mock Execute-Main { }
Register-Mock Get-CustomCredentials { return "CustomCredentialsObject" }

Manage-IISWebApplication -parentWebsiteName $parentWebsiteNameForApplication -virtualPath $virtualPathForApplication -physicalPath $physicalPathForApplication -physicalPathAuth $applicationPhysicalPathAuth -physicalPathAuthUserName $applicationAuthUserName -physicalPathAuthUserPassword $applicationAuthUserPassword `
    -createOrUpdateAppPool $createOrUpdateAppPoolForApplication -appPoolName $appPoolNameForApplication -dotNetVersion $dotNetVersionForApplication -pipeLineMode $pipeLineModeForApplication -appPoolIdentity $appPoolIdentityForApplication -appPoolUsername $appPoolUsernameForApplication -appPoolPassword $appPoolPasswordForApplication `
    -appCmdCommands $appCmdCommands

Assert-WasCalled Get-CustomCredentials -Times 2
Assert-WasCalled Execute-Main -Times 1 
Assert-WasCalled Execute-Main -- -CreateApplication "True" -WebsiteName "Sample Web Site" -VirtualPath "/Application" -PhysicalPath "Drive:/Physical Path" -PhysicalPathAuth "ApplicationWindowsAuth" -PhysicalPathAuthCredentials "CustomCredentialsObject" -ActionIISApplicationPool "CreateOrUpdateAppPool" -AppPoolName "Sample App Pool" -DotNetVersion "v4.0" -PipeLineMode "Integrated" -AppPoolIdentity "SpecificUser" -AppPoolCredentials "CustomCredentialsObject" -AppCmdCommands ""

# Test 3

$virtualPathForApplication = "Application"

Assert-Throws {
    Manage-IISWebApplication -parentWebsiteName $parentWebsiteNameForApplication -virtualPath $virtualPathForApplication -physicalPath $physicalPathForApplication -physicalPathAuth $applicationPhysicalPathAuth -physicalPathAuthUserName $applicationAuthUserName -physicalPathAuthUserPassword $applicationAuthUserPassword `
        -createOrUpdateAppPool $createOrUpdateAppPoolForApplication -appPoolName $appPoolNameForApplication -dotNetVersion $dotNetVersionForApplication -pipeLineMode $pipeLineModeForApplication -appPoolIdentity $appPoolIdentityForApplication -appPoolUsername $appPoolUsernameForApplication -appPoolPassword $appPoolPasswordForApplication `
        -appCmdCommands $appCmdCommands
} -MessagePattern "InvalidVirtualPath"