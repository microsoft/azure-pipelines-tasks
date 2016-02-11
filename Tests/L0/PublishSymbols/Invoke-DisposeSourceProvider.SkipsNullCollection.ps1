[cmdletbinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\Helpers.ps1
$provider = New-Object psobject -Property @{ TfsTeamProjectCollection = $null }

# Act/Assert doesn't null ref.
Invoke-DisposeSourceProvider -Provider $provider
