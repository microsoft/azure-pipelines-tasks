[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force

. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\..\WindowsMachineFileCopyJob.ps1

Register-Mock Invoke-Command { }

Copy-OnLocalMachine -sourcePath $validSourcePackage -targetPath $validApplicationPath -adminUserName $userName -adminPassword $password `
                    -cleanTargetBeforeCopy $true -additionalArguments ""

Assert-WasCalled Invoke-Command -Times 1 -ParametersEvaluator {
    $ScriptBlock -eq $CopyJob -and $ArgumentList -contains $validSourcePackage -and $ArgumentList -contains $validApplicationPath -and `
    $ArgumentList -contains $true
}