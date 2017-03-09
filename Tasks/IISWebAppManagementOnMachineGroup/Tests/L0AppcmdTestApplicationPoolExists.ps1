[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockHelpers.ps1

. $PSScriptRoot\..\ps_modules\TaskModuleIISManageUtility\AppCmdOnTargetMachines.ps1

$appPoolName = "Sample App Pool"

# Test 1 : Application pool does not exist 

Register-Mock Invoke-VstsTool { return $null } 

$result = Test-AppPoolExist -appPoolName $appPoolName

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " list apppool /name:`"Sample App Pool`"" 
Assert-AreEqual $false $result

# Test 2 : Application pool already exists

Unregister-Mock Invoke-VstsTool
Register-Mock Invoke-VstsTool { 
    return "apppool /name:`"Sample App Pool`" (applicationPool:DefaultAppPool)"
} -ParametersEvaluator { $FileName -eq "appcmdPath"  -and 
                         $Arguments -eq " list apppool /name:`"Sample App Pool`"" }

$result = Test-AppPoolExist -appPoolName $appPoolName

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " list apppool /name:`"Sample App Pool`"" 
Assert-AreEqual $true $result 

# Test 3 : Return false if appcmd throws error 

Unregister-Mock Invoke-VstsTool
Register-Mock Invoke-VstsTool { 
    Write-Verbose "ERROR ( message:Configuration error`nFilename: redirection.config`nLine Number: 0`nDescription: Cannot read configuration file due to insufficient permissions. )"
    return "ERROR ( message:Configuration error`nFilename: redirection.config`nLine Number: 0`nDescription: Cannot read configuration file due to insufficient permissions. )"
} -ParametersEvaluator { $FileName -eq "appcmdPath"  -and 
                         $Arguments -eq " list apppool /name:`"Sample App Pool`"" }

$result = Test-AppPoolExist -appPoolName $appPoolName

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " list apppool /name:`"Sample App Pool`"" 
Assert-AreEqual $false $result 