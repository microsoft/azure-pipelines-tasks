function Get-VSPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Version)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        if ($Version -eq "16.0" -and
            ($instance = Get-VisualStudio 16) -and
            $instance.installationPath) {
            
            return $instance.installationPath
        }
        # Search for a 15.0 Willow instance.
        if ($Version -eq "15.0" -and
            ($instance = Get-VisualStudio 15) -and
            $instance.installationPath) {

            return $instance.installationPath
        }

        # Fallback to searching for an older install.
        if ($path = (Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\$Version" -Name 'ShellFolder' -ErrorAction Ignore).ShellFolder) {
            return $path
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
