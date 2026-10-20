[CmdletBinding()]
param()
Import-VstsLocStrings "$PSScriptRoot\module.json"

# Dot-source all script files in this folder
Find-VstsFiles -LiteralDirectory $PSScriptRoot -LegacyPattern "*.ps1" | ForEach { . $_ }

Export-ModuleMember -Function Connect-ServiceFabricClusterFromServiceEndpoint
Export-ModuleMember -Function Remove-ClientCertificate
Export-ModuleMember -Function Get-ServiceFabricEncryptedText
Export-ModuleMember -Variable SF_Operations
Export-ModuleMember -Function Publish-Telemetry
Export-ModuleMember -Function Get-SfSdkVersion
Export-ModuleMember -Function Trace-WarningIfCertificateNotPresentInLocalCertStore