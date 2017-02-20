[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Utility.ps1

Register-Mock Write-Warning { }

Check-ContainerNameAndArgs -containerName '$root' -additionalArguments "/S"
Check-ContainerNameAndArgs -containerName '$root' -additionalArguments "/S "
Check-ContainerNameAndArgs -containerName '$root' -additionalArguments "/XN /S /XO"
Check-ContainerNameAndArgs -containerName '$root' -additionalArguments " /S  "
Check-ContainerNameAndArgs -containerName '$root' -additionalArguments "/Y /S"
Assert-WasCalled Write-Warning -Times 5

Unregister-Mock Write-Warning
Register-Mock Write-Warning { }

Check-ContainerNameAndArgs -containerName '$root' -additionalArguments "/SetContentType:video/mp4"
Check-ContainerNameAndArgs -containerName '$root' -additionalArguments "/Source:path /SetContentType:video/mp4"
Assert-WasCalled Write-Warning -Times 0