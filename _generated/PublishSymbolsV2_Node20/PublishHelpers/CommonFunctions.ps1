########################################
# Private functions.
########################################
function Get-ValidValue {
    [CmdletBinding()]
    param(
        [timespan]$Current,
        [timespan]$Minimum,
        [timespan]$Maximum)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        if ($Current -lt $Minimum) { return $Minimum }
        elseif ($Current -gt $Maximum) { return $Maximum }
        else { return $Current }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
