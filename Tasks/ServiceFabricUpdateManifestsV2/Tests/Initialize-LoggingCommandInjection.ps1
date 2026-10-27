# Shared helpers for the *.LoggingCommandInjection.ps1 tests. Dot-source after Initialize-Test.ps1.
#
# The agent parses '##vso[' anywhere in a line written to the host, so no log line produced by this task may
# contain a live marker, whatever the manifest, file name, build or input values are.

$global:LoggedHostLines = @()

function Register-HostCapture
{
    $global:LoggedHostLines = @()

    # The product code always passes the complete line as the first argument of Write-Host.
    Register-Mock Write-Host { $global:LoggedHostLines += ,([string]$args[0]) }
}

function Assert-NoLiveLoggingCommands
{
    param([object[]]$Lines = $global:LoggedHostLines)

    # A test that captured nothing would pass vacuously, so insist on at least one captured line.
    Assert-IsNotNullOrEmpty $Lines "No output was captured, the assertion would be meaningless."
    $live = @($Lines | Where-Object { $_ -match '##vso\[' -or $_ -match '##\[' })
    Assert-AreEqual 0 $live.Count "Output still contains a live logging-command marker: $($live -join ' | ')"
}

function Assert-LogLineWritten
{
    param([string]$Expected)

    $found = @($global:LoggedHostLines | Where-Object { $_ -ceq $Expected })
    Assert-AreEqual 1 $found.Count "Expected exactly one log line equal to '$Expected'. Captured lines:`n$($global:LoggedHostLines -join "`n")"
}
