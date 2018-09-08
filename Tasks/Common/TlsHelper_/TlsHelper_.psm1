Import-VstsLocStrings -LiteralPath $PSScriptRoot/module.json

function Add-Tls12InSession {
    [CmdletBinding()]
    param()

    try {
        if ([Net.ServicePointManager]::SecurityProtocol.ToString().Split(',').Trim() -notcontains 'Tls12') {
            $securityProtocol=@()
            $securityProtocol+=[Net.ServicePointManager]::SecurityProtocol
            $securityProtocol+=[Net.SecurityProtocolType]3072
            [Net.ServicePointManager]::SecurityProtocol=$securityProtocol
            
            Write-Host (Get-VstsLocString -Key TLS12AddedInSession)
        }
        else {
            Write-Verbose 'TLS 1.2 already present in session.'
        }
    }
    catch {
        Write-Host (Get-VstsLocString -Key "UnableToAddTls12InSession" -ArgumentList $($_.Exception.Message))
    }
}

function Assert-TlsError {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [AllowNull()]
        $exception
    )

    if ($exception -eq $null)
    {
        return
    }

    $hasWebException = $false
    $hasIOException = $false
    $innerException = $exception
    while ($innerException -ne $null)
    {
        if ($innerException.GetType() -eq [System.Net.WebException])
        {
            $hasWebException = $true
        }
        elseif ($innerException.GetType() -eq [System.IO.IOException])
        {
            $hasIOException = $true
        }
        $innerException = $innerException.InnerException
    }

    if (($hasWebException -eq $true) -and ($hasIOException -eq $true))
    {
        Write-VstsTaskError -Message (Get-VstsLocString -Key UnsupportedTLSError)
    }
}

Export-ModuleMember -Function Add-Tls12InSession
Export-ModuleMember -Function Assert-TlsError