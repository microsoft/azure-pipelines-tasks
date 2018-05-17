########################################
# Public functions.
########################################
function Invoke-UnpublishSymbols {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Share,
        [Parameter(Mandatory = $true)]
        [string]$TransactionId,
        [Parameter(Mandatory = $true)]
        [timespan]$MaximumWaitTime,
        [Parameter(Mandatory = $true)]
        [string]$SemaphoreMessage)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $MaximumWaitTime = Get-ValidValue -Current $MaximumWaitTime -Minimum ([timespan]::FromMinutes(1)) -Maximum ([timespan]::FromHours(3))
        $semaphore = Lock-Semaphore -Share $Share -MaximumWaitTime $MaximumWaitTime -SemaphoreMessage $SemaphoreMessage
        try {
            $symstoreArgs = "del /i ""$TransactionId"" /s ""$Share"""
            Invoke-VstsTool -FileName (Get-SymStorePath) -Arguments $symstoreArgs -WorkingDirectory ([System.IO.Path]::GetTempPath()) -RequireExitCodeZero 2>&1 |
                ForEach-Object {
                    if ($_ -is [System.Management.Automation.ErrorRecord]) {
                        Write-Error $_
                    } else {
                        Write-Host $_
                    }
                }
        } finally {
            Unlock-Semaphore $semaphore
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
