function Test-FileEqual
{
    [CmdletBinding()]
    [OutputType([bool])]
    Param
    (
        [Parameter(Mandatory=$true)]
        [ValidateScript({Test-Path -LiteralPath $_})]
        [string]
        $Path1,

        [Parameter(Mandatory=$true)]
        [ValidateScript({Test-Path -LiteralPath $_})]
        [string]
        $Path2
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Based on my testing, using 'ComputeHash', 'Out-String' and '-eq' is about:
        # 50x faster than 'Get-Content', 'Out-String', and '-eq'
        # 10-15x faster than 'Get-Content' and 'Compare-Object'
        # 3x faster than 'ComputeHash' and 'Compare-Object'
        # 1.2x *slower* than 'Get-FileHash' and '-eq', but Get-FileHash isn't available until PowerShell 4.0

        $sha256 = [System.Security.Cryptography.SHA256]::Create()

        try {
            $stream1 = [System.IO.File]::OpenRead($Path1)
            $hash1 = $sha256.ComputeHash($stream1) | Out-String
        }
        finally {
            if ($stream1 -ne $null) {
                $stream1.Dispose()
            }
        }

        try {
            $stream2 = [System.IO.File]::OpenRead($Path2)
            $hash2 = $sha256.ComputeHash($stream2) | Out-String
        }
        finally {
            if ($stream2 -ne $null) {
                $stream2.Dispose()
            }
        }

        $hash1 -eq $hash2
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}