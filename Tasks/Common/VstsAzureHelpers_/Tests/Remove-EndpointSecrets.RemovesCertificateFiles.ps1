[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
Unregister-Mock Import-Module
Register-Mock Get-VstsWebProxy { }

$originalAgentTempDirectory = $env:Agent_TempDirectory
$originalDefaultWorkingDirectory = $env:System_DefaultWorkingDirectory
$originalCertificatePassword = $env:AZCOPY_SPA_CERT_PASSWORD
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
$agentTempDirectory = Join-Path $testRoot "agent-temp"
$defaultWorkingDirectory = Join-Path $testRoot "default-working-directory"
$certificateFileNames = @("clientcertificate.pem", "clientcertificate.pfx", "clientcertificatepassword.txt")

try {
    New-Item -Path $agentTempDirectory -ItemType Directory -Force | Out-Null
    New-Item -Path $defaultWorkingDirectory -ItemType Directory -Force | Out-Null

    foreach ($certificateDirectory in @($agentTempDirectory, $defaultWorkingDirectory)) {
        foreach ($certificateFileName in $certificateFileNames) {
            Set-Content -Path (Join-Path $certificateDirectory $certificateFileName) -Value "secret"
        }
    }

    $env:Agent_TempDirectory = $agentTempDirectory
    $env:System_DefaultWorkingDirectory = $defaultWorkingDirectory
    $env:AZCOPY_SPA_CERT_PASSWORD = "secret"

    $module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

    # Act.
    & $module Remove-EndpointSecrets

    # Assert.
    foreach ($certificateDirectory in @($agentTempDirectory, $defaultWorkingDirectory)) {
        foreach ($certificateFileName in $certificateFileNames) {
            Assert-AreEqual $false (Test-Path (Join-Path $certificateDirectory $certificateFileName)) "Certificate file should be removed"
        }
    }

    Assert-AreEqual $null $env:AZCOPY_SPA_CERT_PASSWORD "Certificate password environment variable should be cleared"
}
finally {
    $env:Agent_TempDirectory = $originalAgentTempDirectory
    $env:System_DefaultWorkingDirectory = $originalDefaultWorkingDirectory
    $env:AZCOPY_SPA_CERT_PASSWORD = $originalCertificatePassword
    Remove-Item -Path $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}