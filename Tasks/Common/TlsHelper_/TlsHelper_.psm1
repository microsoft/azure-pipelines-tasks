Import-VstsLocStrings -LiteralPath $PSScriptRoot/module.json

function Add-Tls12InSession {
    [CmdletBinding()]
    param()

    try {
        if ([Net.ServicePointManager]::SecurityProtocol -notcontains 'Tls12') {
            [Net.ServicePointManager]::SecurityProtocol += [Net.SecurityProtocolType]3072
            Write-Host (Get-VstsLocString -Key TLS12AddedInSession)
        }
        else {
            Write-Verbose 'TLS 1.2 already present in session.'
        }
    }
    catch {
        Write-VstsTaskError "Failed to add TLS 1.2 in session: $_.Exception.Message"
    }
}

function Assert-TlsError {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)] $exception 
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