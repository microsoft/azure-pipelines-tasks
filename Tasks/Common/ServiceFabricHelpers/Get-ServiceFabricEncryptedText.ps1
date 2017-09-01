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

    $defaultCertStoreName = "My"
    $defaultCertStoreLocation = "CurrentUser"
    $serverCertThumbprint = $ClusterConnectionParameters["ServerCertThumbprint"]

    $cert = Get-Item "Cert:\$defaultCertStoreLocation\$defaultCertStoreName\$serverCertThumbprint" -ErrorAction SilentlyContinue
    if (-not $cert)
    {
        throw (Get-VstsLocString -Key ServerCertificateNotFoundForTextEncrypt -ArgumentList $serverCertThumbprint)
    }

    # Encrypt the text using the cluster connection's certificate.
    return Invoke-ServiceFabricEncryptText -Text $Text -CertStore -CertThumbprint $serverCertThumbprint -StoreName $defaultCertStoreName -StoreLocation $defaultCertStoreLocation
}