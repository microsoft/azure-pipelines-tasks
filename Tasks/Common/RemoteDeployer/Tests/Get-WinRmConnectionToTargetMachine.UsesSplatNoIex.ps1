[CmdletBinding()]
param()

# Guard the no-string-build contract: SessionHelper.ps1 must call New-PSSession via @splat
# and never use Invoke-Expression or the old Get-NewPSSessionCommand string-builder.
. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1

$src = Get-Content "$PSScriptRoot\..\SessionHelper.ps1" -Raw

# The vulnerable patterns must be gone (search for actual code calls, not comment text).
$srcLinesNoComments = ($src -split "`r?`n" | ForEach-Object { ($_ -split '#',2)[0] }) -join "`n"
Assert-AreEqual $true (-not ($srcLinesNoComments -match 'Invoke-Expression')) `
    'SessionHelper.ps1 must not call Invoke-Expression in any code line'
Assert-AreEqual $true (-not ($src -match 'function\s+Get-NewPSSessionCommand')) `
    'The Get-NewPSSessionCommand string-builder function must be removed'

# The splat-based replacement must be in place. Anchor on `@psSessionParams` so we
# don't false-match an unrelated `New-PSSession -SkipCACheck` later.
Assert-AreEqual $true ($src -match 'New-PSSession\s+@psSessionParams') `
    'Get-WinRmConnectionToTargetMachine must call New-PSSession via @splat (New-PSSession @psSessionParams)'

# The splat must carry the previously-interpolated values as data, including the bare-
# interpolation Port (the original injection vector).
$paramSet = 'ComputerName','Port','Authentication','Name','ConfigurationName','ErrorAction','ErrorVariable'
foreach ($p in $paramSet) {
    Assert-AreEqual $true ($src -match "(?m)^\s*$p\s*=") `
        "The New-PSSession splat must include the parameter '$p' as a hashtable entry"
}