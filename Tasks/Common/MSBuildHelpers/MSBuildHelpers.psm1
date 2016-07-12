[CmdletBinding()]
param()
Import-VstsLocStrings "$PSScriptRoot\module.json"
. $PSScriptRoot\ArgumentFunctions
. $PSScriptRoot\InvokeFunctions
. $PSScriptRoot\PathFunctions
Export-ModuleMember -Function @(
    # Argument functions.
    'Format-MSBuildArguments'
    'Get-UserAgentString'
    # Invoke functions.
    'Invoke-BuildTools'
    # Path functions.
    'Get-MSBuildPath'
    'Get-SolutionFiles'
)