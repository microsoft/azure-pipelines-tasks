[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockHelpers.ps1

. $PSScriptRoot\..\ps_modules\TaskModuleIISManageUtility\AppCmdOnTargetMachines.ps1

$applicationName = "Sample Web Site/Application"

# Test 1 : Application does not exist 
Register-Mock Invoke-VstsTool { 
    return $null 
} -ParametersEvaluator { $FileName -eq "appcmdPath"  -and 
                         $Arguments -eq " list app `"Sample Web Site/Application`"" }

$result = Test-ApplicationExist -applicationName $applicationName

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " list app `"Sample Web Site/Application`"" 
Assert-AreEqual $false $result

# Test 2 : Application already exists

Unregister-Mock Invoke-VstsTool
Register-Mock Invoke-VstsTool { 
    return "APP `"Sample Web Site/Application`" (applicationPool:DefaultAppPool)"
} -ParametersEvaluator { $FileName -eq "appcmdPath"  -and 
                         $Arguments -eq " list app `"Sample Web Site/Application`"" }

$result = Test-ApplicationExist -applicationName $applicationName

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " list app `"Sample Web Site/Application`"" 
Assert-AreEqual $true $result 

# Test 3 : Return false if appcmd throws error 

Unregister-Mock Invoke-VstsTool
Register-Mock Invoke-VstsTool { 
    Write-Verbose "ERROR ( message:Configuration error`nFilename: redirection.config`nLine Number: 0`nDescription: Cannot read configuration file due to insufficient permissions. )"
    return "ERROR ( message:Configuration error`nFilename: redirection.config`nLine Number: 0`nDescription: Cannot read configuration file due to insufficient permissions. )"
} -ParametersEvaluator { $FileName -eq "appcmdPath"  -and 
                         $Arguments -eq " list app `"Sample Web Site/Application`"" }

$result = Test-ApplicationExist -applicationName $applicationName

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " list app `"Sample Web Site/Application`"" 
Assert-AreEqual $false $result 