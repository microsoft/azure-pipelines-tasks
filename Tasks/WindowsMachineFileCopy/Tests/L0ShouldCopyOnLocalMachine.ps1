[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force
. $PSScriptRoot\MockHelper.ps1 -Force

& "$copyFilesToMachinesPath" -environmentName "" -sourcePath $validSourcePackage -targetPath $validApplicationPath -cleanTargetBeforeCopy $true -copyFilesInParallel $false -adminUserName $userName -adminPassword $password
