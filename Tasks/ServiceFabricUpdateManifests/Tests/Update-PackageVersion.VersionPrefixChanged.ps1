[CmdletBinding()]
param()

. "$PSScriptRoot\Test-PackageVersion.ps1" ".NewSuffix" '<CodePackage Name="Code" Version="0.9.9.OldSuffix"></CodePackage>'