[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$taskRoot = Split-Path -Parent $PSScriptRoot
$mainPath = Join-Path $taskRoot "Main.ps1"
$sdkManifest = Join-Path $taskRoot "ps_modules\VstsTaskSdk\VstsTaskSdk.psd1"

if (!(Test-Path -LiteralPath $sdkManifest -PathType Leaf)) {
    throw "VstsTaskSdk was not found. Build the task before running this test: '$sdkManifest'"
}

$childScriptPath = Join-Path $env:TEMP "SqlDacpacDeploymentOnMachineGroupV0-ErrorOutput-$([guid]::NewGuid()).ps1"
$childScript = @'
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$MainPath,

    [Parameter(Mandatory = $true)]
    [string]$SdkManifest)

Import-Module -Name $SdkManifest -ArgumentList @{ NonInteractive = $true }

$mainAst = [System.Management.Automation.Language.Parser]::ParseFile($MainPath, [ref]$null, [ref]$null)
$writeExceptionAst = $mainAst.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Write-Exception'
}, $true)[0]
. ([ScriptBlock]::Create($writeExceptionAst.Extent.Text))

Write-Host "__BEGIN_TASK_FAILURE__"
Invoke-VstsTaskScript -ScriptBlock {
    $exception = [System.Exception]::new("Deployment failed")
    $errorRecord = [System.Management.Automation.ErrorRecord]::new(
        $exception,
        "SqlDeploymentFailure",
        [System.Management.Automation.ErrorCategory]::NotSpecified,
        $null)

    Write-Exception -exception $exception -errorRecord $errorRecord
}
'@

try {
    Set-Content -LiteralPath $childScriptPath -Value $childScript -Encoding UTF8

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = "powershell.exe"
    $startInfo.Arguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$childScriptPath`" -MainPath `"$mainPath`" -SdkManifest `"$sdkManifest`""
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    $null = $process.Start()
    $standardOutput = $process.StandardOutput.ReadToEnd()
    $standardError = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    Assert-AreEqual 0 $process.ExitCode "Task SDK test process should exit successfully. STDERR: $standardError"

    $taskFailureMarker = "__BEGIN_TASK_FAILURE__"
    $taskFailureMarkerIndex = $standardOutput.IndexOf($taskFailureMarker, [System.StringComparison]::Ordinal)
    if ($taskFailureMarkerIndex -lt 0) {
        throw "Task failure marker was not found. Captured output: $standardOutput"
    }

    $taskOutput = $standardOutput.Substring($taskFailureMarkerIndex + $taskFailureMarker.Length)
    $displayedErrors = [regex]::Matches(
        $taskOutput,
        '(?m)^##vso\[task\.logissue type=error(?:;[^\]]*)?\](?<message>.*)$')

    Assert-AreEqual 1 $displayedErrors.Count "One caught exception should display one task error. Captured task output: $taskOutput"
    Assert-AreEqual "Deployment failed" $displayedErrors[0].Groups["message"].Value.Trim() "The displayed task error should preserve the exception message."
}
finally {
    Remove-Item -LiteralPath $childScriptPath -Force -ErrorAction SilentlyContinue
}
