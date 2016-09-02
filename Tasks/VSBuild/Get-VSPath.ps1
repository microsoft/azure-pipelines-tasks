function Get-VSPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Version)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        if ($path = (Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\$Version" -Name 'ShellFolder' -ErrorAction Ignore).ShellFolder) {
            return $path.TrimEnd('\'[0])
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
