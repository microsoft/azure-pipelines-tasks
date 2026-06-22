[CmdletBinding()]
param()

# Test: VsoFilterTextWriter must escape ##vso[ commands written to Console.Out.
#
# This test uses the ACTUAL production VsoFilterTextWriter.ps1 to verify that
# the filter correctly escapes ##vso[ → ##_vso[ for all console output.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

# Load the PRODUCTION VsoFilterTextWriter (same file used by PowerShellOnTargetMachines.ps1)
. $PSScriptRoot\..\VsoFilterTextWriter.ps1

# Install VsoFilterTextWriter wrapping a StringWriter to capture filtered output
$stringWriter = New-Object System.IO.StringWriter
$filter = New-Object VsoFilterTextWriter($stringWriter)
[Console]::SetOut($filter)

try {
    # Simulate compromised VM output written to Console.Out (as DTT DLLs do)
    [Console]::WriteLine("##vso[task.setvariable variable=injectedSecret;issecret=true]stolen-value")
    [Console]::WriteLine("##vso[task.setvariable variable=Build.Repository.Clean]true")
    [Console]::WriteLine("Legitimate script output from VM")
    [Console]::WriteLine("  ##vso[task.logissue type=warning]indented injection attempt")
    [Console]::WriteLine("Mixed line with ##vso[task.complete result=Failed] mid-text")
    $filter.Flush()
} finally {
    $filter.Restore()
}

$output = $stringWriter.ToString()

# Verify: NO raw ##vso[ commands in the output
$rawVsoLines = ($output -split "`n") | Where-Object { $_ -match '##vso\[' }
Assert-AreEqual 0 $rawVsoLines.Count "Raw ##vso[ commands must not pass through VsoFilterTextWriter. Found: $($rawVsoLines -join '; ')"

# Verify: escaped ##_vso[ commands ARE present (diagnostic visibility)
$escapedLines = ($output -split "`n") | Where-Object { $_ -match '##_vso\[' }
Assert-AreEqual 4 $escapedLines.Count "All 4 lines with ##vso[ should be escaped to ##_vso[. Found $($escapedLines.Count)"

# Verify: legitimate output passes through unchanged
Assert-AreEqual $true ($output -match 'Legitimate script output from VM') "Legitimate output should pass through unchanged"

# Verify: mid-line ##vso[ is also caught
Assert-AreEqual $true ($output -match 'Mixed line with ##_vso\[task\.complete') "Mid-line ##vso[ should also be escaped"

