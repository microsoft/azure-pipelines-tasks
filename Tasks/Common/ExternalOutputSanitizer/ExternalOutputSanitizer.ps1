# Neutralizes "##vso[...]" and "##[...]" logging-command markers in untrusted
# external output (e.g. SQL query results) so they can't be executed as agent
# commands. Shared so other tasks printing untrusted external output can reuse it.
#
# The agent parses the bytes the host writes to stdout, not this string. Windows PowerShell encodes redirected
# console output with the console output encoding (typically a single-byte OEM code page such as 437) and best-fit maps
# look-alike characters such as U+FF03 FULLWIDTH NUMBER SIGN to ASCII, which could create a marker after the text was
# sanitized. The text is therefore normalized through that encoding before it is checked.
function Protect-ExternalOutput {
    [CmdletBinding()]
    [OutputType([string])]
    param(
        [Parameter(ValueFromPipeline = $true)]
        [AllowNull()]
        [AllowEmptyString()]
        [string] $InputObject,

        # Documentation/telemetry only; does not affect filtering.
        [Parameter(Mandatory = $true)]
        [ValidateSet('remote', 'childProcess', 'repository')]
        [string] $Source,

        # Encoding the host uses to write the text. Defaults to the console output encoding
        [System.Text.Encoding] $Encoding,

        [ValidateSet('disabled', 'telemetryOnly', 'blockOnly', 'blockAndTelemetry')]
        [string] $VsoCommandMode = 'blockOnly'
    )

    begin {
        if ($null -eq $Encoding) {
            try {
                $Encoding = [Console]::OutputEncoding
            }
            catch {
                $Encoding = $null
            }
        }
    }

    process {
        if ($null -eq $InputObject) {
            return
        }

        $text = $InputObject
        if ($null -ne $Encoding) {
            try {
                $text = $Encoding.GetString($Encoding.GetBytes($InputObject))
            }
            catch {
                $text = $InputObject
            }
        }

        $block = $VsoCommandMode -in @('blockOnly', 'blockAndTelemetry')
        if ($VsoCommandMode -in @('telemetryOnly', 'blockAndTelemetry')) {
            foreach ($match in [regex]::Matches($text, '##vso\[([\w]+\.[\w]+)(?=[ ;\]])', 'IgnoreCase')) {
                $event = @{
                    source = $Source
                    commandName = $match.Groups[1].Value.ToLowerInvariant()
                    blocked = $block
                }
                $eventJson = ConvertTo-Json $event -Compress
                Write-Host "##vso[telemetry.publish area=TaskHub;feature=ExternalOutputVsoCommand]$eventJson"
            }
        }

        if ($block) {
            ($text -replace '##vso\[', '##_vso[') -replace '##\[', '##_['
        }
        else {
            $InputObject
        }
    }
}
