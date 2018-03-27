function Add-Tls12InSession {
    [CmdletBinding()]
    param()

    try {
        [Net.ServicePointManager]::SecurityProtocol += [Net.SecurityProtocolType]::Tls12
    }
    catch {
    }
}

Export-ModuleMember -Function Add-Tls12InSession