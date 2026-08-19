[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Utility.ps1

Register-Mock Write-Warning { }

Check-ContainerNameAndArgs -containerName '$root' -additionalArguments " --recursive "
Check-ContainerNameAndArgs -containerName '$root' -additionalArguments " --recursive --log-level=ERROR "
Check-ContainerNameAndArgs -containerName '$root' -additionalArguments " --recursive --log-level=ERROR"

Assert-WasCalled Write-Warning -Times 3

Unregister-Mock Write-Warning