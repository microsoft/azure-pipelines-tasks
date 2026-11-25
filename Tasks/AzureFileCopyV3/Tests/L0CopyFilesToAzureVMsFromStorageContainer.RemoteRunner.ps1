[CmdletBinding()]
param()

& {
try
{
. $PSScriptRoot\TargetPathHardeningHelper.ps1
. $PSScriptRoot\..\..\Common\RemoteDeployer\RunPowerShellScriptJob.ps1

Register-Mock Get-WmiObject { return [pscustomobject]@{ UUID = 'mock-machine' } }
Register-Mock Invoke-RestMethod { }
Register-Mock Get-Service { }

# The shared runner really writes its UTF-8 temporary scripts and launches powershell.exe.
# Only the remote job is a stand-in: it cannot copy tools, clean folders or contact Azure.
$standInRemoteJob = @'
param(
    [string]$containerURL, [string]$targetPath, [string]$containerSasToken,
    [string]$additionalArguments, [string]$azCopyToolFileNamesString,
    [string]$azCopyToolFileContentsString, [switch]$CleanTargetBeforeCopy,
    [switch]$EnableDetailedLogging, [switch]$useSanitizerActivate,
    [switch]$useSourcePathHardening, [switch]$disableTargetPathHardening
)
foreach ($name in @('containerURL', 'targetPath', 'containerSasToken', 'additionalArguments',
                     'azCopyToolFileNamesString', 'azCopyToolFileContentsString'))
{
    $value = [string]$PSBoundParameters[$name]
    Write-Output ("RECEIVED " + $name + "=" + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($value)))
}
Write-Output ("RECEIVED source=" + $useSourcePathHardening.IsPresent)
Write-Output ("RECEIVED sanitizer=" + $useSanitizerActivate.IsPresent)
Write-Output ("RECEIVED rollback=" + $disableTargetPathHardening.IsPresent)
'@

function Assert-RealRunner
{
    param([string]$Value, [bool]$OldFlags)

    $global:toolFile.Name = $Value
    $job = Get-GeneratedRemoteJob @{
        containerName = $Value; targetPath = $Value; containerSasToken = $Value
        additionalArguments = $Value; useSourcePathHardening = $OldFlags
        useSanitizerActivate = $OldFlags
    }
    $output = (& $ExecutePsScript -scriptPath '' -scriptArguments $job.scriptArguments `
        -inlineScript $standInRemoteJob -inline $true -workingDirectory '' `
        -_errorActionPreference 'Stop' -ignoreLASTEXITCODE $false -failOnStdErr $false `
        -initializationScriptPath '' -sessionVariables '' 2>&1 | Out-String)
    Assert-AreEqual $false ([regex]::IsMatch($output, '(?m)^INJECTED-MARKER\s*$'))
    $expected = @{
        containerURL = "https://storage.invalid/$Value"; targetPath = $Value
        containerSasToken = $Value; additionalArguments = $Value
        azCopyToolFileNamesString = $Value; azCopyToolFileContentsString = $toolContents
    }
    foreach ($name in $expected.Keys)
    {
        $match = [regex]::Match($output, "(?m)^RECEIVED $name=([A-Za-z0-9+/=]*)")
        Assert-AreEqual $true $match.Success "Shared runner must report $name"
        $received = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($match.Groups[1].Value))
        Assert-AreEqual $expected[$name] $received "Shared runner round-trip: $name"
    }
    foreach ($name in @('source', 'sanitizer'))
    {
        Assert-AreEqual $true ([regex]::IsMatch($output, "(?m)^RECEIVED $name=$OldFlags\s*$"))
    }
    Assert-AreEqual $true ([regex]::IsMatch($output, '(?m)^RECEIVED rollback=False\s*$'))
}

foreach ($codepoint in @(0x27, 0x2018, 0x2019, 0x201A, 0x201B))
{
    # Construct Unicode from codepoints for BOM-less Windows PowerShell 5.1 files.
    Assert-RealRunner ('x' + [char]$codepoint + '; Write-Output INJECTED-MARKER; #') $false
}
Assert-RealRunner "C:\Bob's Files\" $true
}
finally
{
    Restore-TargetPathHardeningTestState
}
}
