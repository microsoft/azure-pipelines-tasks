[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Utility.ps1

$optInName = 'AZP_WINDOWSMACHINEFILECOPY_LEGACY_COMMAND'
$previousProcessValue = [Environment]::GetEnvironmentVariable($optInName, 'Process')
$global:optInValue = $null
$global:optInReadFails = $false

try
{
    Assert-AreEqual 'Windows_NT' (Get-MachineEnvironmentVariable 'OS')

    $processOnlyName = 'WMFC_PROCESS_ONLY_' + [guid]::NewGuid().ToString('N')
    [Environment]::SetEnvironmentVariable($processOnlyName, 'true', 'Process')
    try
    {
        Assert-AreEqual $true ($null -eq (Get-MachineEnvironmentVariable $processOnlyName)) 'A process-level variable must not be visible through the machine-level reader.'
    }
    finally
    {
        [Environment]::SetEnvironmentVariable($processOnlyName, $null, 'Process')
    }

    [Environment]::SetEnvironmentVariable($optInName, 'true', 'Process')
    Assert-AreEqual ([Environment]::GetEnvironmentVariable($optInName, 'Machine') -eq 'true') (Test-LegacyCommandOptIn)

    Register-Mock Get-MachineEnvironmentVariable {
        if ($global:optInReadFails)
        {
            throw 'read failed'
        }

        return $global:optInValue
    }

    $cases = @(
        @{ Value = 'true'; Expected = $true },
        @{ Value = 'TRUE'; Expected = $true },
        @{ Value = 'false'; Expected = $false },
        @{ Value = '1'; Expected = $false },
        @{ Value = 'yes'; Expected = $false },
        @{ Value = ' true'; Expected = $false },
        @{ Value = 'true '; Expected = $false },
        @{ Value = 'truex'; Expected = $false },
        @{ Value = ''; Expected = $false },
        @{ Value = $null; Expected = $false }
    )
    foreach ($case in $cases)
    {
        $global:optInValue = $case.Value
        Assert-AreEqual $case.Expected (Test-LegacyCommandOptIn)
    }

    $global:optInReadFails = $true
    Assert-AreEqual $false (Test-LegacyCommandOptIn)

    Assert-WasCalled Get-MachineEnvironmentVariable -Times ($cases.Count + 1) $optInName
}
finally
{
    Unregister-Mock Get-MachineEnvironmentVariable
    Remove-Variable -Name optInValue, optInReadFails -Scope Global -ErrorAction SilentlyContinue
    [Environment]::SetEnvironmentVariable($optInName, $previousProcessValue, 'Process')
}
