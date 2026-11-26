[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\Common\ExternalOutputSanitizer\ExternalOutputSanitizer.ps1
. $PSScriptRoot\..\RoboCopyJob.ps1

$previousExitCode = $global:LASTEXITCODE
$script:commandBlocking = $false
$script:exitCode = 0
$script:copyCalls = 0
$script:failures = @()
$script:results = @()
$payload = "file.txt`n##vso[task.setvariable variable=PATH]untrusted`n##VsO[task.complete result=Succeeded;]untrusted"

function Get-VstsPipelineFeature {
    param([string]$FeatureName)
    Assert-AreEqual 'EnableVsoCommandBlockingRMTasks' $FeatureName
    return $script:commandBlocking
}
function New-PSDrive {}
function Remove-PSDrive {}
function Get-PSDrive { return $null }
function New-Item {}
function Remove-Item {}
function Test-Path { return $false }
function ConvertTo-SecureString {
    param([string]$String)
    $secureString = New-Object System.Security.SecureString
    foreach ($character in $String.ToCharArray()) {
        $secureString.AppendChar($character)
    }
    $secureString.MakeReadOnly()
    return $secureString
}
function robocopy {
    $script:copyCalls++
    $global:LASTEXITCODE = $script:exitCode
    $payload
}
function Write-VstsTaskError { param($Message) $script:failures += $Message }
function Write-VstsSetResult { param($Result, $Message, [switch]$DoNotThrow) $script:results += $Result }
function Split-AdditionalArguments { param($additionalArguments) $additionalArguments.Split(' ') }

try {
    $credential = New-Object System.Net.NetworkCredential('user', 'password')
    foreach ($blocking in @($false, $true)) {
        $script:commandBlocking = $blocking
        foreach ($hardening in @($false, $true)) {
            foreach ($argumentSanitizer in @('false', 'true')) {
                foreach ($exitCode in @(0, 7, 8)) {
                    $script:exitCode = $exitCode
                    $script:copyCalls = 0
                    $script:failures = @()
                    $script:results = @()
                    $output = & $CopyJob '' 'C:\source' 'C:\target' $credential 'true' '' (Split-Path $PSScriptRoot -Parent) $argumentSanitizer $hardening 6>&1
                    $text = ($output | ForEach-Object { "$_" }) -join "`n"
                    $expected = if ($blocking) { $payload -replace '##vso\[', '##_vso[' } else { $payload }
                    Assert-AreEqual 2 $script:copyCalls 'Both cleanup and copy must run.'
                    Assert-AreEqual 2 ([regex]::Matches($text, [regex]::Escape($expected)).Count) 'Both output paths must use the selected mode.'
                    $events = @($output | Where-Object { "$_" -like '*telemetry.publish*' })
                    Assert-AreEqual 4 $events.Count
                    foreach ($event in $events) {
                        Assert-AreEqual $false ("$event".Contains('untrusted')) 'Telemetry must not include filenames or command values.'
                        Assert-AreEqual $true ("$event".Contains('"blocked":' + "$blocking".ToLowerInvariant()))
                    }
                    if ($exitCode -ge 8) {
                        Assert-AreEqual 1 $script:failures.Count
                        Assert-AreEqual 'Failed' $script:results[0]
                    } else {
                        Assert-AreEqual 0 $script:failures.Count
                        Assert-AreEqual 0 $script:results.Count
                    }
                }
            }
        }
    }
}
finally {
    $global:LASTEXITCODE = $previousExitCode
}
