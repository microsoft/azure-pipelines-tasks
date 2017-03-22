[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockHelpers.ps1

. $PSScriptRoot\..\Utility.ps1

$parentWebsiteNameForVD = "Sample Web Site"
$virtualPathForVD = "/App/Vdir"
$physicalPathForVD = "Drive:/Physical path"
$vdPhysicalPathAuth = "VDUserPassThrough"
$vdAuthUserName = ""
$vdAuthUserPassword = ""
$appCmdCommands = ""

# Test 1 

Register-Mock Invoke-Main { }

Set-IISVirtualDirectory -parentWebsiteName $parentWebsiteNameForVD -virtualPath $virtualPathForVD -physicalPath $physicalPathForVD -PhysicalPathAuth  $vdPhysicalPathAuth `
                -physicalPathAuthUserName $vdAuthUserName -physicalPathAuthUserPassword $vdAuthUserPassword -appCmdCommands $appCmdCommands

Assert-WasCalled Invoke-Main -Times 1
Assert-WasCalled Invoke-Main -- -CreateVirtualDirectory "True" -WebsiteName "Sample Web Site" -VirtualPath "/App/Vdir" -PhysicalPath "Drive:/Physical path" -PhysicalPathAuth "VDUserPassThrough" -PhysicalPathAuthCredentials $null -AppCmdCommands ""

# Test 2 

$virtualPathForVD = "App/Vdir"
Assert-Throws {
    Set-IISVirtualDirectory -parentWebsiteName $parentWebsiteNameForVD -virtualPath $virtualPathForVD -physicalPath $physicalPathForVD -PhysicalPathAuth  $vdPhysicalPathAuth `
        -physicalPathAuthUserName $vdAuthUserName -physicalPathAuthUserPassword $vdAuthUserPassword -appCmdCommands $appCmdCommands
} -MessagePattern "InvalidVirtualPath"

# Test 3 

$virtualPathForVD = "/App/Vdir"
$vdPhysicalPathAuth = "VDWindowsAuth"
$vdAuthUserName = "name"
$vdAuthUserPassword = "pass"

Unregister-Mock Invoke-Main 
Register-Mock Invoke-Main { }

Register-Mock Get-CustomCredentials { return "CustomCredentialsObject" }

Set-IISVirtualDirectory -parentWebsiteName $parentWebsiteNameForVD -virtualPath $virtualPathForVD -physicalPath $physicalPathForVD -PhysicalPathAuth  $vdPhysicalPathAuth `
    -physicalPathAuthUserName $vdAuthUserName -physicalPathAuthUserPassword $vdAuthUserPassword -appCmdCommands $appCmdCommands

Assert-WasCalled Invoke-Main -Times 1
Assert-WasCalled Invoke-Main -- -CreateVirtualDirectory "True" -WebsiteName "Sample Web Site" -VirtualPath "/App/Vdir" -PhysicalPath "Drive:/Physical path" -PhysicalPathAuth "VDWindowsAuth" -PhysicalPathAuthCredentials "CustomCredentialsObject" -AppCmdCommands ""