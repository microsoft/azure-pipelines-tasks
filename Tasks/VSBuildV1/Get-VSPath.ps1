function Get-VSPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Version)        
        
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $VersionNumber = [int]$Version.Remove(2)
        # Search for more than 15.0 Willow instance.
            if (
                $VersionNumber -ge 15 -and
                ($instance = Get-VisualStudio $VersionNumber) -and
                $instance.installationPath) {
                
                return $instance.installationPath
            }
     
        if ($path = (Get-ItemProperty -LiteralPath "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\$Version" -Name 'ShellFolder' -ErrorAction Ignore).ShellFolder) {
                return $path
        }
    } catch {
            Write-Warning "please enter version in format like 15.0, 16.0, 17.0..."           
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}