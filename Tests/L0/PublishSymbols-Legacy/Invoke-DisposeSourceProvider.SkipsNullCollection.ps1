[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1 -Legacy
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\LegacyIndexHelpers.ps1
$provider = New-Object psobject -Property @{ TfsTeamProjectCollection = $null }

# Act/Assert doesn't null ref.
Invoke-DisposeSourceProvider -Provider $provider
