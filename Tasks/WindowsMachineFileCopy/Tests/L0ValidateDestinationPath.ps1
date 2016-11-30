[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockVariable.ps1 -Force

. $PSScriptRoot\..\Utility.ps1

Register-Mock Get-ResourceFQDNTagKey { return $validResourceFQDNKeyName }

Assert-Throws {
   Validate-DestinationPath -value "" -environmentName $validEnvironmentName
} -Message "Parameter 'targetPath' cannot be null or empty."

Assert-Throws {
    Validate-DestinationPath -value $invalidTargetPath -environmentName $validEnvironmentName
} -Message "Remote destination path '$invalidTargetPath' cannot contain environment variables."
