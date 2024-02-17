[CmdletBinding()]
param()

Unregister-Mock Get-VstsWebProxy;
Unregister-Mock Add-Tls12InSession;
Unregister-Mock Invoke-Process;
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1;
Register-Mock Get-VstsWebProxy { };
Register-Mock Add-Tls12InSession { };

$certTestDirectory = Join-Path $PSScriptRoot 'CertTestFiles';

$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru;

$testScriptExitCode = -1;

# Copied from the actual implementation
# https://github.com/microsoft/azure-pipelines-task-lib/blob/5fb0f50e81296db185b3291c4da56e220a3ee098/powershell/VstsTaskSdk/ToolFunctions.ps1#L79
# Just ensuring Node is used instead of openssl, and adding the desired script to the args
Register-Mock Invoke-Process {
    param(
        [ValidatePattern('^[^\r\n]*$')]
        [Parameter(Mandatory = $true)]
        [string]$FileName,
        [ValidatePattern('^[^\r\n]*$')]
        [Parameter()]
        [string]$Arguments,
        [string]$WorkingDirectory,
        [string]$StdOutPath,
        [string]$StdErrPath,
        [switch]$RequireExitCodeZero
    )

    $testScript = (Join-Path $certTestDirectory 'argument-test.js');
    $FileName = "node.exe";
    $Arguments = "$testScript $Arguments";
    
    Write-Host "##[command]""$FileName"" $Arguments"

    $processOptions = @{
        FilePath     = $FileName
        NoNewWindow  = $true
        PassThru     = $true
    }
    if ($Arguments) {
        $processOptions.Add("ArgumentList", $Arguments)
    }
    if ($WorkingDirectory) {
        $processOptions.Add("WorkingDirectory", $WorkingDirectory)
    }
    if ($StdOutPath) {
        $processOptions.Add("RedirectStandardOutput", $StdOutPath)
    }
    if ($StdErrPath) {
        $processOptions.Add("RedirectStandardError", $StdErrPath)
    }

    # TODO: For some reason, -Wait is not working on agent.
    # Agent starts executing the System usage metrics and hangs the step forever.
    $proc = Start-Process @processOptions

    # https://stackoverflow.com/a/23797762
    $null = $($proc.Handle)
    $proc.WaitForExit()

    $procExitCode = $proc.ExitCode

    $global:LASTEXITCODE = $procExitCode;
    $script:testScriptExitCode = $LASTEXITCODE;

    return $procExitCode
}

$content = 'Foo';

$expectedFiles = @()
try {
    Describe "Validate paths for openssl" {
        BeforeAll {
            $ENV:Agent_TempDirectory = $certTestDirectory;
            &$module ConvertTo-Pfx $content;
            $script:expectedFiles = @("$ENV:Agent_TempDirectory\clientcertificate.pem", "$ENV:Agent_TempDirectory\clientcertificate.pfx", "$ENV:Agent_TempDirectory\clientcertificatepassword.txt");
        }

        It "Has an exit code of 0" {
            Assert-AreEqual -Expected 0 -Actual $testScriptExitCode;
        }
        AfterAll {
            foreach ($path in $script:expectedFiles) {
                if (Test-Path $path) {
                    Remove-Item $path;
                }
            }
        }
    }

    Describe "Validate paths with spaces" {
        BeforeAll {
            $certTestDirectoryWithSpaces = Join-Path $certTestDirectory "Cert With Spaces";
            New-Item $certTestDirectoryWithSpaces -ItemType Directory;
            $ENV:Agent_TempDirectory = $certTestDirectoryWithSpaces;
            $script:expectedFiles = @("$ENV:Agent_TempDirectory\clientcertificate.pem", "$ENV:Agent_TempDirectory\clientcertificate.pfx", "$ENV:Agent_TempDirectory\clientcertificatepassword.txt");

            &$module ConvertTo-Pfx $content;
        }

        It "Has an exit code of 0" {
            Assert-AreEqual -Expected 0 -Actual $testScriptExitCode;
        }

        AfterAll {
            Remove-Item -Recurse $certTestDirectoryWithSpaces;
        }
    }
}
finally {
    Microsoft.PowerShell.Core\Remove-Module $module;
}