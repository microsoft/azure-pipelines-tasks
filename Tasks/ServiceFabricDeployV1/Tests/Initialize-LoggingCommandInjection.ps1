# Shared helpers for the *.LoggingCommandInjection.ps1 tests. Dot-source after Initialize-Test.ps1.
#
# The agent parses '##vso[' anywhere in a line the task writes to the host, and the host also formats any object left in
# the success stream, so both count as output. Text provided by the cluster is sanitized with blockAndTelemetry: the
# only live command that may remain is the audit event, which names the blocked command but never carries its payload.

$global:LoggedHostLines = @()
$global:AuditEventPrefix = '##vso[telemetry.publish area=TaskHub;feature=ExternalOutputVsoCommand]'

function Register-HostCapture
{
    $global:LoggedHostLines = @()

    # Write-Host joins its positional arguments with a space.
    Register-Mock Write-Host { $global:LoggedHostLines += ,([string]($args -join ' ')) }
}

function Clear-HostCapture
{
    $global:LoggedHostLines = @()
}

function Get-CapturedHostText
{
    "Captured lines:`n$($global:LoggedHostLines -join "`n")"
}

function Assert-NoLiveLoggingCommands
{
    param([object[]]$Lines = $global:LoggedHostLines)

    # A test that captured nothing would pass vacuously, so insist on at least one captured line.
    Assert-IsNotNullOrEmpty $Lines "No output was captured, the assertion would be meaningless."
    $live = @($Lines |
        Where-Object { -not ([string]$_).StartsWith($global:AuditEventPrefix) } |
        Where-Object { $_ -match '##vso\[' -or $_ -match '##\[' })
    Assert-AreEqual 0 $live.Count "Output still contains a live logging-command marker: $($live -join ' | ')"
}

function Assert-AuditEventWritten
{
    param([string]$CommandName, [int]$Count = 1)

    $auditLines = @($global:LoggedHostLines | Where-Object { ([string]$_).StartsWith($global:AuditEventPrefix) })
    $events = @($auditLines |
        ForEach-Object { ([string]$_).Substring($global:AuditEventPrefix.Length) | ConvertFrom-Json })
    $matching = @($events |
        Where-Object { $_.commandName -eq $CommandName -and $_.source -eq 'remote' -and $_.blocked -eq $true })
    Assert-AreEqual $Count $matching.Count `
        "Expected $Count blocked '$CommandName' audit event(s) from a remote source. $(Get-CapturedHostText)"
}

function Assert-NoAuditEventWritten
{
    $auditLines = @($global:LoggedHostLines | Where-Object { ([string]$_).StartsWith($global:AuditEventPrefix) })
    Assert-AreEqual 0 $auditLines.Count "Ordinary output must not raise an audit event: $($auditLines -join ' | ')"
}

function Assert-LogLineWritten
{
    param([string]$Expected)

    $found = @($global:LoggedHostLines | Where-Object { $_ -ceq $Expected })
    Assert-AreEqual 1 $found.Count "Expected exactly one log line equal to '$Expected'. $(Get-CapturedHostText)"
}
