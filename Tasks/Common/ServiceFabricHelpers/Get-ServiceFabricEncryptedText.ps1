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
    $serverCertThumbprints = $ClusterConnectionParameters["ServerCertThumbprint"]

    if ($serverCertThumbprints -is [array])
    {
        foreach ($serverCertThumbprint in $serverCertThumbprints)
        {
            $cert = Get-Item "Cert:\$defaultCertStoreLocation\$defaultCertStoreName\$serverCertThumbprint" -ErrorAction SilentlyContinue
            if ($cert)
            {
                break
            }
        }
    }
    else
    {
        $cert = Get-Item "Cert:\$defaultCertStoreLocation\$defaultCertStoreName\$serverCertThumbprints" -ErrorAction SilentlyContinue
    }

    if (-not $cert)
    {
        Write-Warning (Get-VstsLocString -Key ServerCertificateNotFoundForTextEncrypt -ArgumentList $serverCertThumbprints)
        return $null
    }

    # Encrypt the text using the cluster connection's certificate.
    $global:operationId = $SF_Operations.EncryptServiceFabricText
    return Invoke-ServiceFabricEncryptText -Text $Text -CertStore -CertThumbprint $cert.Thumbprint -StoreName $defaultCertStoreName -StoreLocation $defaultCertStoreLocation
}