function Get-VSPath {
    [CmdletBinding()]
    param([string]$Version)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Default to all versions if not specified.
        if ($Version) {
            $versionsToTry = ,$Version
        } else {
            # TODO: THIS ELSE BLOCK ISN'T NEEDED AT ALL. ADD TESTS, CHANGE THE PARAM TO MANDATORY, AND REMOVE THIS ELSE BLOCK.
            # Upstream callers depend on the sort order.
            $versionsToTry = "14.0", "12.0", "11.0", "10.0"
        }

        foreach ($Version in $versionsToTry) {
            if ($path = (Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\$Version" -Name 'ShellFolder' -ErrorAction Ignore).ShellFolder) {
                return $path.TrimEnd('\'[0])
            }
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
