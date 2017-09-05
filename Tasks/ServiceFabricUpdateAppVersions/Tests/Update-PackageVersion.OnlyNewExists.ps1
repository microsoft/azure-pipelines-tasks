[CmdletBinding()]
param()

. "$PSScriptRoot\Test-NonExistentPackagePath.ps1" -ExpectedSuffix ".NewSuffix" -CurrentCodePackageExists