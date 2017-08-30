# Note: Connect-ServiceFabricClusterFromServiceEndpoint must be called prior to invoking this function. That function properly initializes
# the values in the cluster connection parameters that this function uses.
function Get-ServiceFabricEncryptedText
{
    Param (
        [String]
        $Text,

        [Hashtable]
        $ClusterConnectionParameters
    )

    # For now, only support clusters using certificate-based auth since that provides the easiest way of getting a cert.
    if ($ClusterConnectionParameters["X509Credential"] -ne $true)
    {
        throw (Get-VstsLocString -Key NonCertBasedAuthForTextEncryptionError)
    }

    # Encrypt the text using the cluster connection's certificate.
    $result = Invoke-ServiceFabricEncryptText -Text $Text -CertStore -CertThumbprint $ClusterConnectionParameters["FindValue"] -StoreName $ClusterConnectionParameters["StoreName"] -StoreLocation $ClusterConnectionParameters["StoreLocation"]
    Write-Host "Result: " $result
    return $result
}