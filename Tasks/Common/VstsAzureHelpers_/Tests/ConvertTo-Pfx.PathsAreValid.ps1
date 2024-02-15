[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1;
Register-Mock Get-VstsWebProxy { };
Register-Mock Add-Tls12InSession { };

$certTestDirectory = Join-Path $PSScriptRoot 'CertTestFiles';

$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru;

$testScriptExitCode = -1;
$testScriptOutput = "";

Register-Mock Invoke-VstsTool {
    param(
        [string]$FileName,
        [string]$Arguments,
        [switch]$RequireExitCodeZero
    )

    $testScript = (Join-Path $certTestDirectory 'argument-test.js');

    $script:testScriptOutput = Invoke-Expression "& 'node.exe' '$testScript' --% $Arguments";
    $script:testScriptExitCode = $LASTEXITCODE;

    return $true;
}

$ENV:Agent_TempDirectory = $certTestDirectory;

$content = Get-Content (Join-Path $certTestDirectory 'originalcert.pem') -Raw;

$expectedOutput = 'File exists';
$expectedFiles = @("$ENV:Agent_TempDirectory\clientcertificate.pem", "$ENV:Agent_TempDirectory\clientcertificate.pfx", "$ENV:Agent_TempDirectory\clientcertificatepassword.txt");
try {
    Describe "Validate paths for openssl" {
        BeforeAll {
            &$module ConvertTo-Pfx $content;
        }

        It "Has an exit code of 0" {
            Assert-AreEqual -Expected 0 -Actual $testScriptExitCode;
        }

        It "Has an output of '$expectedOutput'" {
            Assert-AreEqual -Expected $expectedOutput -Actual $testScriptOutput;
        }
    }
}
finally {
    foreach ($path in $expectedFiles) {
        if (Test-Path $path) {
            Remove-Item $path;
        }
    }
    Unregister-Mock Invoke-VstsTool;
}