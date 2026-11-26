[CmdletBinding()]
param(
    [string]$endpoint,
    [string]$connectedServiceNameARM,
    [string]$targetAzurePs,
    [bool]$isPSCore,
    [string]$vstsAccessToken
)

function global:Import-VstsLocStrings { }
function global:Get-VstsWebProxy { $null }
function global:Get-VstsPipelineFeature { $false }

$helperModule = New-Module -Name CrossProcessVstsAzureHelpers -ArgumentList $env:CROSS_PROCESS_HELPER_UTILITY -ScriptBlock {
    param($utilityPath)
    . $utilityPath
    Export-ModuleMember -Function Remove-EndpointSecrets
}
Import-Module $helperModule
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
    "CN=AzurePowerShellV5-Cleanup-$([guid]::NewGuid())",
    $rsa,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$certificate = $request.CreateSelfSigned([datetimeoffset]::Now.AddMinutes(-1), [datetimeoffset]::Now.AddMinutes(10))
$store = [System.Security.Cryptography.X509Certificates.X509Store]::new(
    [System.Security.Cryptography.X509Certificates.StoreName]::My,
    [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser)

try {
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $store.Add($certificate)
}
finally {
    $store.Close()
}

& $helperModule { param($thumbprint) $script:Endpoint_Authentication_Certificate = $thumbprint } $certificate.Thumbprint
[System.IO.File]::WriteAllText($env:CROSS_PROCESS_THUMBPRINT_FILE, $certificate.Thumbprint)