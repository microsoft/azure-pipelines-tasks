[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

# $CopyJob imports legacy DistributedTask modules that are not installed in the test
# environment; mock them to no-ops so the scriptblock reaches the net-use and robocopy steps
# under test.
Register-Mock Import-Module { }
Register-Mock Write-VstsTaskError { }
Register-Mock Write-VstsSetResult { }

. $PSScriptRoot\..\RoboCopyJob.ps1

# Verifies that special characters in the resource FQDN reach the net use / robocopy commands as
# literal text and are never evaluated as PowerShell.
#
# A no-op net.exe (resolved via a redirected $env:windir) lets the net-use mapping succeed so
# execution reaches the robocopy step; a no-op robocopy.exe placed first on $env:PATH then stands
# in for the actual copy. Both sink points are exercised by the same scriptblock invocation.
function New-NoOpExe {
    param([string]$Path)
    Add-Type -TypeDefinition 'public static class NoOpProgram { public static int Main(string[] a) { return 0; } }' `
        -OutputAssembly $Path -OutputType ConsoleApplication
}

$fakeWindir = Join-Path $env:TEMP "wmfc-fakewindir-$([guid]::NewGuid().ToString('N'))"
$fakePathDir = Join-Path $env:TEMP "wmfc-fakepath-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Force -Path (Join-Path $fakeWindir 'system32'), $fakePathDir | Out-Null
New-NoOpExe -Path (Join-Path $fakeWindir 'system32\net.exe')
New-NoOpExe -Path (Join-Path $fakePathDir 'robocopy.exe')

$originalWindir = $env:windir
$originalPath = $env:PATH
$env:windir = $fakeWindir
$env:PATH = "$fakePathDir;$originalPath"

$canaryPath = Join-Path $env:TEMP "wmfc-canary-$([guid]::NewGuid().ToString('N')).txt"
if (Test-Path $canaryPath) { Remove-Item $canaryPath -Force }
$maliciousFqdn = "testhost.example.com`$(Set-Content -LiteralPath '$canaryPath' -Value pwned)"

$credential = [pscustomobject]@{ UserName = 'CONTOSO\svc-copy'; Password = 'P@ssw0rd!' }
$source = Join-Path $env:TEMP "wmfc-source-$([guid]::NewGuid().ToString('N'))"
$target = Join-Path $env:TEMP "wmfc-target-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Force -Path $source, $target | Out-Null
'hello' | Set-Content (Join-Path $source 'file.txt')

try {
    & $CopyJob -fqdn $maliciousFqdn -sourcePath $source -targetPath $target -credential $credential `
        -cleanTargetBeforeCopy 'false' -additionalArguments '' -useSanitizerActivate 'false' `
        -enableWindowsMachineFileCopyArgumentsHardening $false -scriptRoot "$PSScriptRoot\.."
} catch {
    # The net-use/robocopy no-op stubs should let this complete; a throw here is not itself a
    # failure of this test - what matters is whether the canary file below was created.
}

try {
    if (Test-Path $canaryPath) {
        throw "FAIL: resource FQDN was evaluated as PowerShell code instead of treated as literal data (canary file was created at '$canaryPath')."
    }
}
finally {
    $env:windir = $originalWindir
    $env:PATH = $originalPath
    Remove-Item $source, $target -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $fakeWindir, $fakePathDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $canaryPath -Force -ErrorAction SilentlyContinue
}
