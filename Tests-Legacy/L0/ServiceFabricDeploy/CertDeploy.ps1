[CmdletBinding()]
param()

. $PSScriptRoot\..\..\lib\Initialize-Test.ps1

$publishProfilePath = "$PSScriptRoot\data\CertPublishProfile.xml"
$applicationPackagePath = "random package path"
$serviceConnectionName = "random connection name"
$serverCertThumbprint = "random thumbprint"
$serviceFabricSdkModulePath = "$PSScriptRoot\data\ServiceFabricSDK.ps1"
$appName = "AppName"

# Setup input arguments
Register-Mock Get-VstsInput { $publishProfilePath } -- -Name publishProfilePath
Register-Mock Get-VstsInput { $applicationPackagePath } -- -Name applicationPackagePath -Require
Register-Mock Get-VstsInput { $serviceConnectionName } -- -Name serviceConnectionName -Require
Register-Mock Get-VstsInput { "false" } -- -Name compressPackage

# Setup file resolution
Register-Mock Find-VstsFiles { $publishProfilePath } -- -LegacyPattern $publishProfilePath
Register-Mock Find-VstsFiles { $applicationPackagePath } -- -LegacyPattern $applicationPackagePath -IncludeDirectories

Register-Mock Assert-VstsPath
Register-Mock Test-Path { $true } -- "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK"

# Setup mock VSTS service endpoint
# NOTE: The value defined here is a Base64 encoding of a self-signed certificate created specifically for this test.
$vstsEndpoint = @{
    "Auth" = @{
        "Scheme" = "Certificate" 
        "Parameters" = @{
            "ServerCertThumbprint" = $serverCertThumbprint
            "Certificate" = "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"
            "CertificatePassword" = "certpassword"
        }
    }
}
Register-Mock Get-VstsEndpoint { $vstsEndpoint } -- -Name $serviceConnectionName -Require

$certFindType = [System.Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint
$certFindValue = "DC25F5F1A327D3B2F260FDCA710A52075FAA5236"
$storeName = [System.Security.Cryptography.X509Certificates.StoreName]::My
$storeLocation = [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser

# Setup mock for connection to cluster
Register-Mock Connect-ServiceFabricCluster { $null } -- -X509Credential -FindType $certFindType.ToString() -FindValue $certFindValue -StoreName $storeName.ToString()  -StoreLocation $storeLocation.ToString() -ServerCertThumbprint:$serverCertThumbprint

# Setup mock registry settings
$regKeyObj = @{
    "FabricSDKPSModulePath" = $serviceFabricSdkModulePath
}
Register-Mock Get-ItemProperty { $regKeyObj } -- -Path "HKLM:\SOFTWARE\Microsoft\Service Fabric SDK" -Name FabricSDKPSModulePath

Register-Mock Get-ApplicationNameFromApplicationParameterFile { $appName } -- "$PSScriptRoot\data\ApplicationParameters.xml"

# Indicate that the application does not exist on cluster
Register-Mock Get-ServiceFabricApplication { $null } -- -ApplicationName $appName
$publishArgs = @("-ApplicationParameterFilePath:", "$PSScriptRoot\data\ApplicationParameters.xml",  "-OverwriteBehavior:", "SameAppTypeAndVersion", "-ApplicationPackagePath:", $applicationPackagePath, "-ErrorAction:", "Stop", "-Action:", "RegisterAndCreate")
Register-Mock Publish-NewServiceFabricApplication -Arguments $publishArgs 

try
{
    # Act
    @( & $PSScriptRoot/../../../Tasks/ServiceFabricDeploy/deploy.ps1 )
}
finally
{
    # Cleanup cert that was added by deploy script
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store($storeName, $storeLocation)
    $store.Open(([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite))
    try
    {
        $cert = $store.Certificates.Find($certFindType, $certFindValue, $false)[0]
        if ($cert)
        {
            $store.Remove($cert)
        }    
    }
    finally
    {
        $store.Close()
        $store.Dispose()    
    }
}

# Assert
Assert-WasCalled Publish-NewServiceFabricApplication -Arguments $publishArgs