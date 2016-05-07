########################################
# Private functions.
########################################
function Get-SymStorePath {
    $symstorePath = "$(Get-VstsTaskVariable -Name Agent.HomeDirectory -Require)\externals\symstore\symstore.exe"
    $legacySymstorePath = "$(Get-VstsTaskVariable -Name Agent.HomeDirectory -Require)\Agent\Worker\Tools\Symstore\symstore.exe"
    if (!([System.IO.File]::Exists($symstorePath)) -and		
        ([System.IO.File]::Exists($legacySymstorePath)))		
    {		
        $symstorePath = $legacySymstorePath		
    }
    
    Assert-VstsPath -LiteralPath $symstorePath -PathType Leaf -PassThru
}

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
