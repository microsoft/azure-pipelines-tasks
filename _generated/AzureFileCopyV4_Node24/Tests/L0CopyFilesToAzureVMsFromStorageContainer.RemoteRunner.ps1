[CmdletBinding()]
param()

# Exercise the shared runner's UTF-8 temp file and fresh powershell.exe, not an emulation.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\Common\Sanitizer\ArgumentsSanitizer.ps1
. $PSScriptRoot\..\Utility.ps1
. $PSScriptRoot\..\AzureFileCopyRemoteJob.ps1
. $PSScriptRoot\..\..\Common\RemoteDeployer\RunPowerShellScriptJob.ps1

Register-Mock Get-ChildItem { }
Register-Mock Copy-FilesSequentiallyToAzureVMs { $global:capturedRemoteArgs = $args }
Register-Mock Get-VstsPipelineFeature { return $false }
Register-Mock Get-WmiObject { return @{ UUID = 'unit-test' } }
Register-Mock Invoke-RestMethod { }
Register-Mock Get-Service { }

# The subprocess never downloads or invokes AzCopy or touches the target path.
# Base64 avoids console-code-page dependencies when reporting Unicode data.
$standInRemoteJob = @'
param(
    [string]$containerURL,
    [string]$targetPath,
    [string]$containerSasToken,
    [string]$additionalArguments,
    [switch]$CleanTargetBeforeCopy,
    [switch]$EnableDetailedLogging,
    [switch]$useSanitizerActivate,
    [switch]$useSourcePathHardening,
    [switch]$disableTargetPathHardening
)
function ConvertTo-Base64([string]$s) { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($s)) }
Write-Output ("RECEIVED containerURL=" + (ConvertTo-Base64 $containerURL))
Write-Output ("RECEIVED targetPath=" + (ConvertTo-Base64 $targetPath))
Write-Output ("RECEIVED containerSasToken=" + (ConvertTo-Base64 $containerSasToken))
Write-Output ("RECEIVED additionalArguments=" + (ConvertTo-Base64 $additionalArguments))
Write-Output ("RECEIVED flags=" + $CleanTargetBeforeCopy.IsPresent + "," + $EnableDetailedLogging.IsPresent + "," + $useSanitizerActivate.IsPresent + "," + $useSourcePathHardening.IsPresent + "," + $disableTargetPathHardening.IsPresent)
'@

function Assert-RealRunner
{
    param([string]$Value, [bool]$UseOldFlags)

    Copy-FilesToAzureVMsFromStorageContainer -blobStorageEndpoint 'https://storage.invalid' `
        -containerName "c$Value" -containerSasToken "?sig=$Value" -targetPath "C:\$Value\" `
        -additionalArguments "--x $Value" -azCopyToolLocation $PSScriptRoot `
        -fileCopyJobScript $AzureFileCopyRemoteJob -copyFilesInParallel $false `
        -cleanTargetBeforeCopy $true -enableDetailedLogging $true `
        -useSourcePathHardening $UseOldFlags -useSanitizerActivate $UseOldFlags
    $index = [array]::IndexOf($global:capturedRemoteArgs, '-remoteScriptJobArguments')
    Assert-AreNotEqual -1 $index 'Expected captured remote job arguments.'
    $job = $global:capturedRemoteArgs[$index + 1]
    $savedErrorActionPreference = $ErrorActionPreference
    try
    {
        $output = & $ExecutePsScript -scriptPath '' -scriptArguments $job.scriptArguments `
            -inlineScript $standInRemoteJob -inline $true -workingDirectory $PSScriptRoot `
            -_errorActionPreference 'Stop' -ignoreLASTEXITCODE $false -failOnStdErr $false `
            -initializationScriptPath '' -sessionVariables '' 2>&1 | Out-String
    }
    finally { $ErrorActionPreference = $savedErrorActionPreference }
    Assert-AreEqual $false ([regex]::IsMatch($output, '(?m)^INJECTED-MARKER\s*$')) 'Input must not execute in the child process.'
    $expectedValues = @{
        containerURL = "https://storage.invalid/c$Value"; targetPath = "C:\$Value\"
        containerSasToken = "?sig=$Value"; additionalArguments = "--x $Value"
    }
    foreach ($name in $expectedValues.Keys)
    {
        $match = [regex]::Match($output, "(?m)^RECEIVED $name=([A-Za-z0-9+/=]*)\s*$")
        Assert-AreEqual $true $match.Success "The child process must report $name."
        $received = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($match.Groups[1].Value))
        Assert-AreEqual $expectedValues[$name] $received "$name must survive the real remote runner."
    }
    $flags = "True,True,$UseOldFlags,$UseOldFlags,False"
    Assert-AreEqual $true ($output.Contains("RECEIVED flags=$flags")) 'Generated switches must survive the real runner.'
}

try
{
    foreach ($codePoint in @(0x0027, 0x2018, 0x2019, 0x201A, 0x201B))
    {
        $quote = [string][char]$codePoint
        Assert-RealRunner -Value ($quote + '; Write-Output INJECTED-MARKER; #') -UseOldFlags $false
    }
    $allQuotes = -join (@(0x0027, 0x2018, 0x2019, 0x201A, 0x201B) | ForEach-Object { [char]$_ })
    Assert-RealRunner -Value ("Bob${allQuotes}s Files") -UseOldFlags $true
}
finally
{
    Unregister-Mock Get-VstsPipelineFeature
    Remove-Variable capturedRemoteArgs -Scope Global -ErrorAction SilentlyContinue
}
