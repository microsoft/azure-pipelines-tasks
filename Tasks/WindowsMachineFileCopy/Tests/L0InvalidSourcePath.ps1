[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force
. $PSScriptRoot\MockHelper.ps1 -Force

Assert-Throws {
    & "$copyFilesToMachinesPath" -environmentName $validEnvironmentName -machineNames $validMachineNames -sourcePath "" -targetPath $validApplicationPath -cleanTargetBeforeCopy $true -copyFilesInParallel $false
} -Message "Parameter 'sourcePath' cannot be null or empty."

Assert-Throws {
    & "$copyFilesToMachinesPath" -environmentName $validEnvironmentName -machineNames $validMachineNames -sourcePath $invalidSourcePath -targetPath $validApplicationPath -cleanTargetBeforeCopy $true -copyFilesInParallel $false
} -Message "Source path '$invalidSourcePath' does not exist."
