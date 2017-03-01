[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockHelpers.ps1

. $PSScriptRoot\..\ps_modules\TaskModuleIISManageUtility\AppCmdOnTargetMachines.ps1

$siteName = "Sample Web Site"

# Test 1 : Returns false if website does not exist 
Register-Mock Invoke-VstsTool { 
    return $null 
} -ParametersEvaluator { $FileName -eq "appcmdPath"  -and 
                         $Arguments -eq " list site /name:`"Sample Web Site`"" }

$result = Test-WebsiteExist -siteName $siteName

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " list site /name:`"Sample Web Site`"" 
Assert-AreEqual $false $result 

# Test 2 : Returns true if website already exists 

Unregister-Mock Invoke-VstsTool
Register-Mock Invoke-VstsTool { 
    return "SITE `"Sample Web Site`" (id:1,bindings:http/*:80:,state:Started)"
} -ParametersEvaluator { $FileName -eq "appcmdPath"  -and 
                         $Arguments -eq " list site /name:`"Sample Web Site`"" }

$result = Test-WebsiteExist -siteName $siteName

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " list site /name:`"Sample Web Site`"" 
Assert-AreEqual $true $result 

# Test 3 : Returns false if appcmd.exe throws error 

Unregister-Mock Invoke-VstsTool
Register-Mock Invoke-VstsTool { 
    Write-Verbose "Invoking stubbed tool"
    Write-Verbose "ERROR ( message:Configuration error`nFilename: redirection.config`nLine Number: 0`nDescription: Cannot read configuration file due to insufficient permissions. )"
    return "ERROR ( message:Configuration error`nFilename: redirection.config`nLine Number: 0`nDescription: Cannot read configuration file due to insufficient permissions. )"
} -ParametersEvaluator { $FileName -eq "appcmdPath"  -and 
                         $Arguments -eq " list site /name:`"Sample Web Site`"" }

$result = Test-WebsiteExist -siteName $siteName

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " list site /name:`"Sample Web Site`"" 
Assert-AreEqual $false $result 