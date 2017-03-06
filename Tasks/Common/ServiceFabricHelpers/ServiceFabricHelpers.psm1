[CmdletBinding()]
param()
Import-VstsLocStrings "$PSScriptRoot\module.json"

# Dot-source all script files in this folder
Find-VstsFiles -LiteralDirectory $PSScriptRoot -LegacyPattern "*.ps1" | ForEach { . $_ }

Export-ModuleMember -Function Connect-ServiceFabricClusterFromServiceEndpoint