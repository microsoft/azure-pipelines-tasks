[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\.. -PassThru

$tms = @(
    @{
        computerName = "computer1";
        sessionConfigurationName = "microsoft.powershell";
        WSManPort = "5985";
        Authentication = "Default";
        UseSsl = $false;
        Credential = $null
    },
    @{
        computerName = "computer2";
        sessionConfigurationName = "microsoft.powershell";
        WSManPort = "5985";
        Authentication = "Default";
        UseSsl = $false;
        Credential = $null
    }
)

Register-Mock Get-PSSession { @{ state = 'disconnected'; availability = 'none'} };
Register-Mock Receive-PSSession { throw "Cannot connect to pssession and return a job" }  
$rv = & $module Retry-Connection $tms 'computer1' 'session1'
Assert-AreEqual $rv $null