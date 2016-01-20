[CmdletBinding()]
param()
Remove-Item -LiteralPath "$PSScriptRoot\Strings\resources.resjson\en-US\resources.resjson" -ErrorAction Ignore # This is a temporary targeted fix due to ConvertFrom-Json not appreciating leading comments in the en-US resjson file. None of the other language resjson files have leading comments.
Import-VstsLocStrings "$PSScriptRoot\module.json"
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