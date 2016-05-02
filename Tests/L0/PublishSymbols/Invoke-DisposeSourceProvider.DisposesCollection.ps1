[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\Tasks\PublishSymbols\IndexHelpers\SourceProviderFunctions.ps1
$global:disposeCount = 0
$tfsTeamProjectCollection = New-Object psobject
$tfsTeamProjectCollection | Add-Member -MemberType ScriptMethod -Name Dispose -Value { $global:disposeCount++ }
$provider = New-Object psobject -Property @{ TfsTeamProjectCollection = $tfsTeamProjectCollection }

# Act.
Invoke-DisposeSourceProvider -Provider $provider

# Assert.
Assert-AreEqual 1 $global:disposeCount
Assert-AreEqual $null $provider.TfsTeamProjectCollection
