[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [bool]
    $ExpectedResult,

    [Parameter(Mandatory=$true)]
    [ValidateNotNull()]
    [string[]]
    $NewFiles,

    [Parameter(Mandatory=$true)]
    [string[]]
    $OldFiles,

    [string]
    $ExpectedLogKey,

    [int]
    $ExpectedLogCalls,

    [int]
    $ExpectedFileEqualCalls,

    [string[]]
    $ChangedFiles,

    [switch]
    $LogAllChanges
)

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\..\..\Tasks\ServiceFabricUpdateAppVersions\Find-FileChanges.psm1"

# Arrange.

$newPkg = "$PSScriptRoot\data\CurrentPkg"
$oldPkg = "$PSScriptRoot\data\PreviousPkg"

Register-Mock Get-VstsLocString

$NewFiles = $NewFiles | ForEach-Object { "$newPkg\$_" }
$OldFiles = $OldFiles | ForEach-Object { "$oldPkg\$_" }
Register-Mock Find-VstsFiles { $NewFiles } -- -LiteralDirectory $newPkg -LegacyPattern "**" -Force
Register-Mock Find-VstsFiles { $null } -- -LiteralDirectory $newPkg -LegacyPattern "**\*.pdb" -Force
Register-Mock Find-VstsFiles { $OldFiles } -ArgumentsEvaluator { $args[1] -eq $oldPkg }

$ChangedFiles = $ChangedFiles | ForEach-Object { "$newPkg\$_" }
Register-Mock Test-FileEqual { $true } -ArgumentsEvaluator { $ChangedFiles -notcontains $args[0] }
Register-Mock Test-FileEqual { $false } -ArgumentsEvaluator { $ChangedFiles -contains $args[0] }

# Act
$result = Find-FileChanges $newPkg $oldPkg -LogAllChanges:$LogAllChanges

# Assert
Assert-AreEqual $ExpectedResult $result

if ($ExpectedLogKey)
{
    Assert-WasCalled Get-VstsLocString -ArgumentsEvaluator { $args[1] -eq $ExpectedLogKey } -Times $ExpectedLogCalls
    Assert-WasCalled Get-VstsLocString -ArgumentsEvaluator { $args[1] -ne $ExpectedLogKey } -Times 0
}
else
{
    Assert-WasCalled Get-VstsLocString -Times 0
}

Assert-WasCalled Test-FileEqual -Times $ExpectedFileEqualCalls
