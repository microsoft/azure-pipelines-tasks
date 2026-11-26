[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\Initialize-LoggingCommandInjection.ps1

Microsoft.PowerShell.Core\Import-Module "$PSScriptRoot\..\Find-FileChanges.psm1"

$newPkg = "$PSScriptRoot\data\CurrentPkg"
$oldPkg = "$PSScriptRoot\data\PreviousPkg"

# The task lower-cases file names before it compares and logs them.
Register-Mock Find-VstsFiles { $NewFiles } -- -LiteralDirectory $newPkg -LegacyPattern "**" -Force
Register-Mock Find-VstsFiles { $null } -- -LiteralDirectory $newPkg -LegacyPattern "**\*.pdb" -Force
Register-Mock Find-VstsFiles { $OldFiles } -ArgumentsEvaluator { $args[1] -eq $oldPkg }
Register-Mock Test-FileEqual { $false }
Register-HostCapture

# Act 1: files are added and removed while both lists are walked, and the remaining new files are added at the end.
$NewFiles = @(
    'a_added##vso[task.setvariable variable=f1]x.dll',
    'd_changed##vso[task.setvariable variable=f2]x.dll',
    'e_tail_added##vso[task.setvariable variable=f3]x.dll',
    'g_tail_added##vso[task.setvariable variable=f4]x.dll') | ForEach-Object { "$newPkg\$_" }
$OldFiles = @(
    'b_removed##vso[task.setvariable variable=f5]x.dll',
    'd_changed##vso[task.setvariable variable=f2]x.dll') | ForEach-Object { "$oldPkg\$_" }
$null = Find-FileChanges $newPkg $oldPkg -LogAllChanges

# Act 2: the remaining old files are removed at the end.
$NewFiles = @(
    'a2_added##vso[task.setvariable variable=f6]x.dll',
    'd2_changed##vso[task.setvariable variable=f7]x.dll') | ForEach-Object { "$newPkg\$_" }
$OldFiles = @(
    'b2_removed##vso[task.setvariable variable=f8]x.dll',
    'd2_changed##vso[task.setvariable variable=f7]x.dll',
    'z2_tail_removed##vso[task.setvariable variable=f9]x.dll') | ForEach-Object { "$oldPkg\$_" }
$null = Find-FileChanges $newPkg $oldPkg -LogAllChanges

# Assert
Assert-NoLiveLoggingCommands
Assert-LogLineWritten '  FileAdded a_added##_vso[task.setvariable variable=f1]x.dll'
Assert-LogLineWritten '  FileRemoved b_removed##_vso[task.setvariable variable=f5]x.dll'
Assert-LogLineWritten '  FileChanged d_changed##_vso[task.setvariable variable=f2]x.dll'
Assert-LogLineWritten '  FileAdded e_tail_added##_vso[task.setvariable variable=f3]x.dll'
Assert-LogLineWritten '  FileAdded g_tail_added##_vso[task.setvariable variable=f4]x.dll'
Assert-LogLineWritten '  FileAdded a2_added##_vso[task.setvariable variable=f6]x.dll'
Assert-LogLineWritten '  FileRemoved b2_removed##_vso[task.setvariable variable=f8]x.dll'
Assert-LogLineWritten '  FileChanged d2_changed##_vso[task.setvariable variable=f7]x.dll'
Assert-LogLineWritten '  FileRemoved z2_tail_removed##_vso[task.setvariable variable=f9]x.dll'
