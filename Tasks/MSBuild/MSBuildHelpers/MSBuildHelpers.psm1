################################################################################
# THIS MODULE IS MASTERED UNDER THE MSBUILD TASK FOLDER. ANY EDITS SHOULD BE
# MADE THERE AND COPIED TO THE VSBUILD TASK FOLDER.
################################################################################

[CmdletBinding()]
param()
Import-VstsLocStrings "$PSScriptRoot\MSBuildHelpers.json"
. $PSScriptRoot\ArgumentFunctions
. $PSScriptRoot\InvokeFunctions
. $PSScriptRoot\PathFunctions
Export-ModuleMember -Function @(
    # Argument functions.
    'Format-MSBuildArguments'
    # Invoke functions.
    'Invoke-BuildTools'
    # Path functions.
    'Get-MSBuildPath'
    'Get-SolutionFiles'
)