[CmdletBinding()]
param(
    [string]$endpoint,
    [string]$connectedServiceNameARM,
    [string]$targetAzurePs,
    [bool]$isPSCore,
    [string]$vstsAccessToken
)

function global:Remove-EndpointSecrets { }

$endpointObject = ConvertFrom-Json $endpoint
$encryptedToken = "encrypted-token"
