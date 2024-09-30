# Get-VstsClientCertificate
[table of contents](../Commands.md#toc) | [brief](../Commands.md#get-vstsclientcertificate)
```
NAME
    Get-VstsClientCertificate

SYNOPSIS
    Gets a client certificate for current connected TFS instance

SYNTAX
    Get-VstsClientCertificate [<CommonParameters>]

DESCRIPTION
    Gets an instance of a X509Certificate2 that is the client certificate Build/Release agent used.

PARAMETERS
    <CommonParameters>
        This cmdlet supports the common parameters: Verbose, Debug,
        ErrorAction, ErrorVariable, WarningAction, WarningVariable,
        OutBuffer, PipelineVariable, and OutVariable. For more information, see
        about_CommonParameters (https://go.microsoft.com/fwlink/?LinkID=113216).

    -------------------------- EXAMPLE 1 --------------------------

    PS C:\>$x509cert = Get-ClientCertificate

    WebRequestHandler.ClientCertificates.Add(x509cert)
```
