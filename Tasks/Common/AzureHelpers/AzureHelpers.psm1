Import-VstsLocStrings -LiteralPath $PSScriptRoot\module.json
. $PSScriptRoot\PrivateFunctions.ps1
. $PSScriptRoot\PublicFunctions.ps1
Export-ModuleMember -Function Initialize-Azure