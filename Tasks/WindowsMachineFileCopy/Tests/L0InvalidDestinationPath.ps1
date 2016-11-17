[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force
. $PSScriptRoot\MockHelper.ps1 -Force

Assert-Throws {
    & "$copyFilesToMachinesPath" -environmentName $validEnvironmentName -machineNames $validMachineNames -sourcePath $validSourcePackage -targetPath "" -cleanTargetBeforeCopy $true -copyFilesInParallel $false
} -Message "Parameter 'targetPath' cannot be null or empty."

Assert-Throws {
    & "$copyFilesToMachinesPath" -environmentName $validEnvironmentName -machineNames $validMachineNames -sourcePath $validSourcePackage -targetPath $invalidTargetPath -cleanTargetBeforeCopy $true -copyFilesInParallel $false
} -Message "Remote destination path '$invalidTargetPath' cannot contain environment variables."
