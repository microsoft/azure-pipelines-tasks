[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

$taskPath = "$PSScriptRoot\.."
. "$taskPath\Assert-ValidManifestPathSegment.ps1"

# Assert-ValidManifestPathSegment is shared by Update-ServiceVersions.psm1, Update-PackageVersion.psm1 and
# Update-DockerImageSettings.psm1; testing it once here covers all three call sites. Its -Name value reaches the host only
# through the task SDK's own Write-Warning/exception reporting, not through Write-Host, so it is tested directly here
# rather than via Register-HostCapture.
$invalidNames = @(
    @{ Case = 'empty string'; Name = '' }
    @{ Case = 'whitespace only'; Name = '   ' }
    @{ Case = 'dot'; Name = '.' }
    @{ Case = 'dot-dot'; Name = '..' }
    @{ Case = 'contains a backslash'; Name = 'a\b' }
    @{ Case = 'contains a forward slash'; Name = 'a/b' }
    @{ Case = 'contains an invalid file-name character'; Name = 'a*b' }
    @{ Case = 'rooted path'; Name = 'C:\a' }
    @{ Case = 'ends with a dot'; Name = 'a.' }
    @{ Case = 'ends with a space'; Name = 'a ' }
)
foreach ($testCase in $invalidNames)
{
    $threw = $false
    try
    {
        Assert-ValidManifestPathSegment -Name $testCase.Name -ElementDescription 'Test/@Name'
    }
    catch
    {
        $threw = $true
    }
    Assert-AreEqual -Expected $true -Actual $threw -Message "Assert-ValidManifestPathSegment should reject a name that is $($testCase.Case)."
}

# A name containing only valid characters should not throw (regression guard for the sanitization change below).
Assert-ValidManifestPathSegment -Name 'Svc##vso[task.setvariable variable=X]x' -ElementDescription 'Test/@Name'

$fullwidthHashes = ([string][char]0xFF03) * 2
$fullwidthVso = '' + [char]0xFF56 + [char]0xFF53 + [char]0xFF4F
$fullwidthOpen = [string][char]0xFF3B
$fullwidthClose = [string][char]0xFF3D

# Each hostile name also ends with '/' so the function has a genuine reason to throw (the forward slash), independent of
# whatever logging-command markers it also carries - the throw path is what reaches the SDK's own (encoding-unaware) escaping.
# Protect-ExternalOutput is called here without an explicit -Encoding (same as the production call), so whether a
# fullwidth look-alike is folded to ASCII first depends on this process's own console encoding; what must hold in every
# environment is that no LIVE marker ever reaches the thrown message. The exact neutralization of look-alikes under a
# specific encoding is already covered deterministically by Protect-ExternalOutput's own tests (L0Protect-ExternalOutput.ps1).
$hostileNames = @(
    @{ Name = 'Svc##vso[task.setvariable variable=T1]x/'; Case = 'an ASCII marker' }
    @{ Name = "Svc${fullwidthHashes}${fullwidthVso}${fullwidthOpen}task.setvariable variable=T2${fullwidthClose}x/"; Case = 'a fullwidth look-alike marker' }
)
foreach ($testCase in $hostileNames)
{
    $thrownMessage = $null
    try
    {
        Assert-ValidManifestPathSegment -Name $testCase.Name -ElementDescription 'Test/@Name'
        Assert-AreEqual -Expected $true -Actual $false -Message "Assert-ValidManifestPathSegment should have thrown for a name ending in '/' ($($testCase.Case))."
    }
    catch
    {
        $thrownMessage = $_.Exception.Message
    }

    Assert-IsNotNullOrEmpty $thrownMessage "No message was thrown for $($testCase.Case), the assertion would be meaningless."
    $live = ($thrownMessage -match '##vso\[' -or $thrownMessage -match '##\[')
    Assert-AreEqual -Expected $false -Actual $live -Message "The thrown message for $($testCase.Case) still contains a live logging-command marker: $thrownMessage"
}

# The ASCII marker is always substituted by the regex regardless of encoding; this confirms Assert-ValidManifestPathSegment
# actually calls Protect-ExternalOutput (not just that no marker happens to survive by coincidence).
$asciiMessage = $null
try { Assert-ValidManifestPathSegment -Name 'Svc##vso[task.setvariable variable=T1]x/' -ElementDescription 'Test/@Name' }
catch { $asciiMessage = $_.Exception.Message }
Assert-AreEqual -Expected $true -Actual ($asciiMessage -match [regex]::Escape('##_vso[task.setvariable variable=T1]x')) -Message "Expected the neutralized ASCII marker in the thrown message: $asciiMessage"
