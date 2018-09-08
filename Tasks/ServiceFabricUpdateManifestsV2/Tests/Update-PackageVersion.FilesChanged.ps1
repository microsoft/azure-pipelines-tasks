[CmdletBinding()]
param()

. "$PSScriptRoot\Test-PackageVersion.ps1" ".NewSuffix" '<CodePackage Name="Code" Version="1.0.0.OldSuffix"></CodePackage>' -FilesChanged