# Get-VstsVssHttpClient
[table of contents](../Commands.md#toc) | [brief](../Commands.md#get-vstsvsshttpclient)
```
NAME
    Get-VstsVssHttpClient

SYNOPSIS
    Gets a VSS HTTP client.

SYNTAX
    Get-VstsVssHttpClient [-TypeName] <String> [[-OMDirectory] <String>] [[-Uri] <String>] [[-VssCredentials]
    <Object>] [[-WebProxy] <Object>] [[-ClientCert] <Object>] [-IgnoreSslError] [<CommonParameters>]

DESCRIPTION
    Gets an instance of an VSS HTTP client.

    *** DO NOT USE Agent.ServerOMDirectory *** See
    https://github.com/Microsoft/azure-pipelines-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage when
    working with the VSTS REST SDK from a task.

PARAMETERS
    -TypeName <String>
        Namespace-qualified type name of the HTTP client to get.

        Required?                    true
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -OMDirectory <String>
        Directory where the REST client object model DLLs are located. If the DLLs for the credential types
        are not already loaded, an attempt will be made to automatically load the required DLLs from the
        object model directory.

        If not specified, defaults to the directory of the entry script for the task.

        *** DO NOT USE Agent.ServerOMDirectory *** See
        https://github.com/Microsoft/azure-pipelines-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage
        when working with the VSTS REST SDK from a task.

        # .PARAMETER Uri
        # URI to use when initializing the HTTP client. If not specified, defaults to
        System.TeamFoundationCollectionUri.

        # .PARAMETER VssCredentials
        # Credentials to use when initializing the HTTP client. If not specified, the default uses the agent
        job token to construct the credentials object. The identity associated with the token depends on the
        scope selected in the build/release definition (either the project collection build/release service
        identity, or the project build/release service identity).

        # .PARAMETER WebProxy
        # WebProxy to use when initializing the HTTP client. If not specified, the default uses the proxy
        configuration agent current has.

        # .PARAMETER ClientCert
        # ClientCert to use when initializing the HTTP client. If not specified, the default uses the client
        certificate agent current has.

        # .PARAMETER IgnoreSslError
        # Skip SSL server certificate validation on all requests made by this HTTP client. If not specified,
        the default is to validate SSL server certificate.

        Required?                    false
        Position?                    2
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -Uri <String>

        Required?                    false
        Position?                    3
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -VssCredentials <Object>

        Required?                    false
        Position?                    4
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -WebProxy <Object>

        Required?                    false
        Position?                    5
        Default value                (Get-WebProxy)
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -ClientCert <Object>

        Required?                    false
        Position?                    6
        Default value                (Get-ClientCertificate)
        Accept pipeline input?       false
        Accept wildcard characters?  false

    -IgnoreSslError [<SwitchParameter>]

        Required?                    false
        Position?                    named
        Default value                False
        Accept pipeline input?       false
        Accept wildcard characters?  false

    <CommonParameters>
        This cmdlet supports the common parameters: Verbose, Debug,
        ErrorAction, ErrorVariable, WarningAction, WarningVariable,
        OutBuffer, PipelineVariable, and OutVariable. For more information, see
        about_CommonParameters (https://go.microsoft.com/fwlink/?LinkID=113216).

    -------------------------- EXAMPLE 1 --------------------------

    PS C:\>$projectHttpClient = Get-VstsVssHttpClient -TypeName
    Microsoft.TeamFoundation.Core.WebApi.ProjectHttpClient

    $projectHttpClient.GetProjects().Result
```
