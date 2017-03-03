[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockHelpers.ps1

. $PSScriptRoot\..\ps_modules\TaskModuleIISManageUtility\AppCmdOnTargetMachines.ps1

$virtualDirectoryName = "Sample Web Site/Application/VirtualDir"

# Test 1 : Virtual directory does not exist 

Register-Mock Invoke-VstsTool { 
    return $null 
} -ParametersEvaluator { $FileName -eq "appcmdPath"  -and 
                         $Arguments -eq " list vdir -vdir.name:`"Sample Web Site/Application/VirtualDir`"" }

$result = Test-VirtualDirectoryExist -virtualDirectoryName $virtualDirectoryName

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " list vdir -vdir.name:`"Sample Web Site/Application/VirtualDir`"" 
Assert-AreEqual $false $result

# Test 2 : Virtual directory already exist

Unregister-Mock Invoke-VstsTool
Register-Mock Invoke-VstsTool { 
    return "vdir -vdir.name:`"Sample Web Site/Application/VirtualDir`" (applicationPool:Defaultvdir)"
} -ParametersEvaluator { $FileName -eq "appcmdPath"  -and 
                         $Arguments -eq " list vdir -vdir.name:`"Sample Web Site/Application/VirtualDir`"" }

$result = Test-VirtualDirectoryExist -virtualDirectoryName $virtualDirectoryName

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " list vdir -vdir.name:`"Sample Web Site/Application/VirtualDir`"" 
Assert-AreEqual $true $result 

# Test 3 : Return false if appcmd throws error 

Unregister-Mock Invoke-VstsTool
Register-Mock Invoke-VstsTool { 
    Write-Verbose "ERROR ( message:Configuration error`nFilename: redirection.config`nLine Number: 0`nDescription: Cannot read configuration file due to insufficient permissions. )"
    return "ERROR ( message:Configuration error`nFilename: redirection.config`nLine Number: 0`nDescription: Cannot read configuration file due to insufficient permissions. )"
} -ParametersEvaluator { $FileName -eq "appcmdPath"  -and 
                         $Arguments -eq " list vdir -vdir.name:`"Sample Web Site/Application/VirtualDir`"" }

$result = Test-VirtualDirectoryExist -virtualDirectoryName $virtualDirectoryName

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -FileName "appcmdPath" -Arguments " list vdir -vdir.name:`"Sample Web Site/Application/VirtualDir`"" 
Assert-AreEqual $false $result 