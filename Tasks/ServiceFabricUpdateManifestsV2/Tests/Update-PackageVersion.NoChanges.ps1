[CmdletBinding()]
param()

. "$PSScriptRoot\Test-PackageVersion.ps1" ".OldSuffix" '<CodePackage Name="Code" Version="1.0.0.OldSuffix"></CodePackage>'