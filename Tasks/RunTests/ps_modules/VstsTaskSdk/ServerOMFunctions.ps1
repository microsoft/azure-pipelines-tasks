<#
.SYNOPSIS
Gets assembly reference information.

.DESCRIPTION
Not supported for use during task exection. This function is only intended to help developers resolve the minimal set of DLLs that need to be bundled when consuming the VSTS REST SDK or TFS Extended Client SDK. The interface and output may change between patch releases of the VSTS Task SDK.

Only a subset of the referenced assemblies may actually be required, depending on the functionality used by your task. It is best to bundle only the DLLs required for your scenario.

Walks an assembly's references to determine all of it's dependencies. Also walks the references of the dependencies, and so on until all nested dependencies have been traversed. Dependencies are searched for in the directory of the specified assembly. NET Framework assemblies are omitted.

See https://github.com/Microsoft/vsts-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage when working with the TFS extended client SDK from a task.

.PARAMETER LiteralPath
Assembly to walk.

.EXAMPLE
Get-VstsAssemblyReference -LiteralPath C:\nuget\microsoft.teamfoundationserver.client.14.102.0\lib\net45\Microsoft.TeamFoundation.Build2.WebApi.dll
#>
function Get-AssemblyReference {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$LiteralPath)

    $ErrorActionPreference = 'Stop'
    Write-Warning "Not supported for use during task exection. This function is only intended to help developers resolve the minimal set of DLLs that need to be bundled when consuming the VSTS REST SDK or TFS Extended Client SDK. The interface and output may change between patch releases of the VSTS Task SDK."
    Write-Output ''
    Write-Warning "Only a subset of the referenced assemblies may actually be required, depending on the functionality used by your task. It is best to bundle only the DLLs required for your scenario."
    $directory = [System.IO.Path]::GetDirectoryName($LiteralPath)
    $hashtable = @{ }
    $queue = @( [System.Reflection.Assembly]::ReflectionOnlyLoadFrom($LiteralPath).GetName() )
    while ($queue.Count) {
        # Add a blank line between assemblies.
        Write-Output ''

        # Pop.
        $assemblyName = $queue[0]
        $queue = @( $queue | Select-Object -Skip 1 )

        # Attempt to find the assembly in the same directory.
        $assembly = $null
        $path = "$directory\$($assemblyName.Name).dll"
        if ((Test-Path -LiteralPath $path -PathType Leaf)) {
            $assembly = [System.Reflection.Assembly]::ReflectionOnlyLoadFrom($path)
        } else {
            $path = "$directory\$($assemblyName.Name).exe"
            if ((Test-Path -LiteralPath $path -PathType Leaf)) {
                $assembly = [System.Reflection.Assembly]::ReflectionOnlyLoadFrom($path)
            }
        }

        # Make sure the assembly full name matches, not just the file name.
        if ($assembly -and $assembly.GetName().FullName -ne $assemblyName.FullName) {
            $assembly = $null
        }

        # Print the assembly.
        if ($assembly) {
            Write-Output $assemblyName.FullName
        } else {
            if ($assemblyName.FullName -eq 'Newtonsoft.Json, Version=6.0.0.0, Culture=neutral, PublicKeyToken=30ad4fe6b2a6aeed') {
                Write-Warning "*** NOT FOUND $($assemblyName.FullName) *** This is an expected condition when using the HTTP clients from the 15.x VSTS REST SDK. Use Get-VstsVssHttpClient to load the HTTP clients (which applies a binding redirect assembly resolver for Newtonsoft.Json). Otherwise you will need to manage the binding redirect yourself."
            } else {
                Write-Warning "*** NOT FOUND $($assemblyName.FullName) ***"
            }
    
            continue
        }

        # Walk the references.
        $refAssemblyNames = @( $assembly.GetReferencedAssemblies() )
        for ($i = 0 ; $i -lt $refAssemblyNames.Count ; $i++) {
            $refAssemblyName = $refAssemblyNames[$i]

            # Skip framework assemblies.
            $fxPaths = @(
                "$env:windir\Microsoft.Net\Framework64\v4.0.30319\$($refAssemblyName.Name).dll"
                "$env:windir\Microsoft.Net\Framework64\v4.0.30319\WPF\$($refAssemblyName.Name).dll"
            )
            $fxPath = $fxPaths |
                Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
                Where-Object { [System.Reflection.Assembly]::ReflectionOnlyLoadFrom($_).GetName().FullName -eq $refAssemblyName.FullName }
            if ($fxPath) {
                continue
            }

            # Print the reference.
            Write-Output "    $($refAssemblyName.FullName)"

            # Add new references to the queue.
            if (!$hashtable[$refAssemblyName.FullName]) {
                $queue += $refAssemblyName
                $hashtable[$refAssemblyName.FullName] = $true
            }
        }
    }
}

<#
.SYNOPSIS
Gets a credentials object that can be used with the TFS extended client SDK.

.DESCRIPTION
The agent job token is used to construct the credentials object. The identity associated with the token depends on the scope selected in the build/release definition (either the project collection build/release service identity, or the project build/release service identity).

Refer to Get-VstsTfsService for a more simple to get a TFS service object.

*** DO NOT USE Agent.ServerOMDirectory *** See https://github.com/Microsoft/vsts-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage when working with the TFS extended client SDK from a task.

.PARAMETER OMDirectory
Directory where the extended client object model DLLs are located. If the DLLs for the credential types are not already loaded, an attempt will be made to automatically load the required DLLs from the object model directory.

If not specified, defaults to the directory of the entry script for the task.

*** DO NOT USE Agent.ServerOMDirectory *** See https://github.com/Microsoft/vsts-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage when working with the TFS extended client SDK from a task.

.EXAMPLE
#
# Refer to Get-VstsTfsService for a more simple way to get a TFS service object.
#
$credentials = Get-VstsTfsClientCredentials
Add-Type -LiteralPath "$PSScriptRoot\Microsoft.TeamFoundation.VersionControl.Client.dll"
$tfsTeamProjectCollection = New-Object Microsoft.TeamFoundation.Client.TfsTeamProjectCollection(
    (Get-VstsTaskVariable -Name 'System.TeamFoundationCollectionUri' -Require),
    $credentials)
$versionControlServer = $tfsTeamProjectCollection.GetService([Microsoft.TeamFoundation.VersionControl.Client.VersionControlServer])
$versionControlServer.GetItems('$/*').Items | Format-List
#>
function Get-TfsClientCredentials {
    [CmdletBinding()]
    param([string]$OMDirectory)

    Trace-EnteringInvocation -InvocationInfo $MyInvocation
    $originalErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Stop'

        # Get the endpoint.
        $endpoint = Get-Endpoint -Name SystemVssConnection -Require

        # Validate the type can be found.
        $null = Get-OMType -TypeName 'Microsoft.TeamFoundation.Client.TfsClientCredentials' -OMKind 'ExtendedClient' -OMDirectory $OMDirectory -Require

        # Construct the credentials.
        $credentials = New-Object Microsoft.TeamFoundation.Client.TfsClientCredentials($false) # Do not use default credentials.
        $credentials.AllowInteractive = $false
        $credentials.Federated = New-Object Microsoft.TeamFoundation.Client.OAuthTokenCredential([string]$endpoint.auth.parameters.AccessToken)
        return $credentials
    } catch {
        $ErrorActionPreference = $originalErrorActionPreference
        Write-Error $_
    } finally {
        Trace-LeavingInvocation -InvocationInfo $MyInvocation
    }
}

<#
.SYNOPSIS
Gets a TFS extended client service.

.DESCRIPTION
Gets an instance of an ITfsTeamProjectCollectionObject.

*** DO NOT USE Agent.ServerOMDirectory *** See https://github.com/Microsoft/vsts-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage when working with the TFS extended client SDK from a task.

.PARAMETER TypeName
Namespace-qualified type name of the service to get.

.PARAMETER OMDirectory
Directory where the extended client object model DLLs are located. If the DLLs for the types are not already loaded, an attempt will be made to automatically load the required DLLs from the object model directory.

If not specified, defaults to the directory of the entry script for the task.

*** DO NOT USE Agent.ServerOMDirectory *** See https://github.com/Microsoft/vsts-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage when working with the TFS extended client SDK from a task.

.PARAMETER Uri
URI to use when initializing the service. If not specified, defaults to System.TeamFoundationCollectionUri.

.PARAMETER TfsClientCredentials
Credentials to use when intializing the service. If not specified, the default uses the agent job token to construct the credentials object. The identity associated with the token depends on the scope selected in the build/release definition (either the project collection build/release service identity, or the project build/release service identity).

.EXAMPLE
$versionControlServer = Get-VstsTfsService -TypeName Microsoft.TeamFoundation.VersionControl.Client.VersionControlServer
$versionControlServer.GetItems('$/*').Items | Format-List
#>
function Get-TfsService {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$TypeName,

        [string]$OMDirectory,

        [string]$Uri,

        $TfsClientCredentials)

    Trace-EnteringInvocation -InvocationInfo $MyInvocation
    $originalErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Stop'

        # Default the URI to the collection URI.
        if (!$Uri) {
            $Uri = Get-TaskVariable -Name System.TeamFoundationCollectionUri -Require
        }

        # Default the credentials.
        if (!$TfsClientCredentials) {
            $TfsClientCredentials = Get-TfsClientCredentials -OMDirectory $OMDirectory
        }

        # Validate the project collection type can be loaded.
        $null = Get-OMType -TypeName 'Microsoft.TeamFoundation.Client.TfsTeamProjectCollection' -OMKind 'ExtendedClient' -OMDirectory $OMDirectory -Require

        # Load the project collection object.
        $tfsTeamProjectCollection = New-Object Microsoft.TeamFoundation.Client.TfsTeamProjectCollection($Uri, $TfsClientCredentials)

        # Validate the requested type can be loaded.
        $type = Get-OMType -TypeName $TypeName -OMKind 'ExtendedClient' -OMDirectory $OMDirectory -Require

        # Return the service object.
        return $tfsTeamProjectCollection.GetService($type)
    } catch {
        $ErrorActionPreference = $originalErrorActionPreference
        Write-Error $_
    } finally {
        Trace-LeavingInvocation -InvocationInfo $MyInvocation
    }
}

<#
.SYNOPSIS
Gets a credentials object that can be used with the VSTS REST SDK.

.DESCRIPTION
The agent job token is used to construct the credentials object. The identity associated with the token depends on the scope selected in the build/release definition (either the project collection build/release service identity, or the project service build/release identity).

Refer to Get-VstsVssHttpClient for a more simple to get a VSS HTTP client.

*** DO NOT USE Agent.ServerOMDirectory *** See https://github.com/Microsoft/vsts-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage when working with the VSTS REST SDK from a task.

.PARAMETER OMDirectory
Directory where the REST client object model DLLs are located. If the DLLs for the credential types are not already loaded, an attempt will be made to automatically load the required DLLs from the object model directory.

If not specified, defaults to the directory of the entry script for the task.

*** DO NOT USE Agent.ServerOMDirectory *** See https://github.com/Microsoft/vsts-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage when working with the VSTS REST SDK from a task.

.EXAMPLE
#
# Refer to Get-VstsTfsService for a more simple way to get a TFS service object.
#
# This example works using the 14.x .NET SDK. A Newtonsoft.Json 6.0 to 8.0 binding
# redirect may be required when working with the 15.x SDK. Or use Get-VstsVssHttpClient
# to avoid managing the binding redirect.
#
$vssCredentials = Get-VstsVssCredentials
$collectionUrl = New-Object System.Uri((Get-VstsTaskVariable -Name 'System.TeamFoundationCollectionUri' -Require))
Add-Type -LiteralPath "$PSScriptRoot\Microsoft.TeamFoundation.Core.WebApi.dll"
$projectHttpClient = New-Object Microsoft.TeamFoundation.Core.WebApi.ProjectHttpClient($collectionUrl, $vssCredentials)
$projectHttpClient.GetProjects().Result
#>
function Get-VssCredentials {
    [CmdletBinding()]
    param([string]$OMDirectory)

    Trace-EnteringInvocation -InvocationInfo $MyInvocation
    $originalErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Stop'

        # Get the endpoint.
        $endpoint = Get-Endpoint -Name SystemVssConnection -Require

        # Check if the VssOAuthAccessTokenCredential type is available.
        if ((Get-OMType -TypeName 'Microsoft.VisualStudio.Services.OAuth.VssOAuthAccessTokenCredential' -OMKind 'WebApi' -OMDirectory $OMDirectory)) {
            # Create the federated credential.
            $federatedCredential = New-Object Microsoft.VisualStudio.Services.OAuth.VssOAuthAccessTokenCredential($endpoint.auth.parameters.AccessToken)
        } else {
            # Validate the fallback type can be loaded.
            $null = Get-OMType -TypeName 'Microsoft.VisualStudio.Services.Client.VssOAuthCredential' -OMKind 'WebApi' -OMDirectory $OMDirectory -Require

            # Create the federated credential.
            $federatedCredential = New-Object Microsoft.VisualStudio.Services.Client.VssOAuthCredential($endpoint.auth.parameters.AccessToken)
        }

        # Return the credentials.
        return New-Object Microsoft.VisualStudio.Services.Common.VssCredentials(
            (New-Object Microsoft.VisualStudio.Services.Common.WindowsCredential($false)), # Do not use default credentials.
            $federatedCredential,
            [Microsoft.VisualStudio.Services.Common.CredentialPromptType]::DoNotPrompt)
    } catch {
        $ErrorActionPreference = $originalErrorActionPreference
        Write-Error $_
    } finally {
        Trace-LeavingInvocation -InvocationInfo $MyInvocation
    }
}

<#
.SYNOPSIS
Gets a VSS HTTP client.

.DESCRIPTION
Gets an instance of an VSS HTTP client.

*** DO NOT USE Agent.ServerOMDirectory *** See https://github.com/Microsoft/vsts-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage when working with the VSTS REST SDK from a task.

.PARAMETER TypeName
Namespace-qualified type name of the HTTP client to get.

.PARAMETER OMDirectory
Directory where the REST client object model DLLs are located. If the DLLs for the credential types are not already loaded, an attempt will be made to automatically load the required DLLs from the object model directory.

If not specified, defaults to the directory of the entry script for the task.

*** DO NOT USE Agent.ServerOMDirectory *** See https://github.com/Microsoft/vsts-task-lib/tree/master/powershell/Docs/UsingOM.md for reliable usage when working with the VSTS REST SDK from a task.

# .PARAMETER Uri
# URI to use when initializing the HTTP client. If not specified, defaults to System.TeamFoundationCollectionUri.

# .PARAMETER VssCredentials
# Credentials to use when intializing the HTTP client. If not specified, the default uses the agent job token to construct the credentials object. The identity associated with the token depends on the scope selected in the build/release definition (either the project collection build/release service identity, or the project build/release service identity).

.EXAMPLE
$projectHttpClient = Get-VstsVssHttpClient -TypeName Microsoft.TeamFoundation.Core.WebApi.ProjectHttpClient
$projectHttpClient.GetProjects().Result
#>
function Get-VssHttpClient {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$TypeName,

        [string]$OMDirectory,

        [string]$Uri,

        $VssCredentials)

    Trace-EnteringInvocation -InvocationInfo $MyInvocation
    $originalErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Stop'

        # Default the URI to the collection URI.
        if (!$Uri) {
            $Uri = Get-TaskVariable -Name System.TeamFoundationCollectionUri -Require
        }

        # Cast the URI.
        [uri]$Uri = New-Object System.Uri($Uri)

        # Default the credentials.
        if (!$VssCredentials) {
            $VssCredentials = Get-VssCredentials -OMDirectory $OMDirectory
        }

        # Validate the type can be loaded.
        $null = Get-OMType -TypeName $TypeName -OMKind 'WebApi' -OMDirectory $OMDirectory -Require

        # Try to construct the HTTP client.
        Write-Verbose "Constructing HTTP client."
        try {
            return New-Object $TypeName($Uri, $VssCredentials)
        } catch {
            # Rethrow if the exception is not due to Newtonsoft.Json DLL not found.
            if ($_.Exception.InnerException -isnot [System.IO.FileNotFoundException] -or
                $_.Exception.InnerException.FileName -notlike 'Newtonsoft.Json, *') {

                throw
            }

            # Default the OMDirectory to the directory of the entry script for the task.
            if (!$OMDirectory) {
                $OMDirectory = [System.IO.Path]::GetFullPath("$PSScriptRoot\..\..")
                Write-Verbose "Defaulted OM directory to: '$OMDirectory'"
            }

            # Test if the Newtonsoft.Json DLL exists in the OM directory.
            $newtonsoftDll = [System.IO.Path]::Combine($OMDirectory, "Newtonsoft.Json.dll")
            Write-Verbose "Testing file path: '$newtonsoftDll'"
            if (!(Test-Path -LiteralPath $newtonsoftDll -PathType Leaf)) {
                Write-Verbose 'Not found. Rethrowing exception.'
                throw
            }

            # Add a binding redirect and try again. Parts of the Dev15 preview SDK have a
            # dependency on the 6.0.0.0 Newtonsoft.Json DLL, while other parts reference
            # the 8.0.0.0 Newtonsoft.Json DLL.
            Write-Verbose "Adding assembly resolver."
            $onAssemblyResolve = [System.ResolveEventHandler]{
                param($sender, $e)

                if ($e.Name -like 'Newtonsoft.Json, *') {
                    Write-Verbose "Resolving '$($e.Name)'"
                    return [System.Reflection.Assembly]::LoadFrom($newtonsoftDll)
                }

                Write-Verbose "Unable to resolve assembly name '$($e.Name)'"
                return $null
            }
            [System.AppDomain]::CurrentDomain.add_AssemblyResolve($onAssemblyResolve)
            try {
                # Try again to construct the HTTP client.
                Write-Verbose "Trying again to construct the HTTP client."
                return New-Object $TypeName($Uri, $VssCredentials)
            } finally {
                # Unregister the assembly resolver.
                Write-Verbose "Removing assemlby resolver."
                [System.AppDomain]::CurrentDomain.remove_AssemblyResolve($onAssemblyResolve)
            }
        }
    } catch {
        $ErrorActionPreference = $originalErrorActionPreference
        Write-Error $_
    } finally {
        Trace-LeavingInvocation -InvocationInfo $MyInvocation
    }
}

########################################
# Private functions.
########################################
function Get-OMType {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$TypeName,

        [ValidateSet('ExtendedClient', 'WebApi')]
        [Parameter(Mandatory = $true)]
        [string]$OMKind,

        [string]$OMDirectory,

        [switch]$Require)

    Trace-EnteringInvocation -InvocationInfo $MyInvocation
    try {
        # Default the OMDirectory to the directory of the entry script for the task.
        if (!$OMDirectory) {
            $OMDirectory = [System.IO.Path]::GetFullPath("$PSScriptRoot\..\..")
            Write-Verbose "Defaulted OM directory to: '$OMDirectory'"
        }

        # Try to load the type.
        $errorRecord = $null
        Write-Verbose "Testing whether type can be loaded: '$TypeName'"
        $ErrorActionPreference = 'Ignore'
        try {
            # Failure when attempting to cast a string to a type, transfers control to the
            # catch handler even when the error action preference is ignore. The error action
            # is set to Ignore so the $Error variable is not polluted.
            $type = [type]$TypeName

            # Success.
            Write-Verbose "The type was loaded successfully."
            return $type
        } catch {
            # Store the error record.
            $errorRecord = $_
        }

        $ErrorActionPreference = 'Stop'
        Write-Verbose "The type was not loaded."

        # Build a list of candidate DLL file paths from the namespace.
        $dllPaths = @( )
        $namespace = $TypeName
        while ($namespace.LastIndexOf('.') -gt 0) {
            # Trim the next segment from the namespace.
            $namespace = $namespace.SubString(0, $namespace.LastIndexOf('.'))

            # Derive potential DLL file paths based on the namespace and OM kind (i.e. extended client vs web API).
            if ($OMKind -eq 'ExtendedClient') {
                if ($namespace -like 'Microsoft.TeamFoundation.*') {
                    $dllPaths += [System.IO.Path]::Combine($OMDirectory, "$namespace.dll")
                }
            } else {
                if ($namespace -like 'Microsoft.TeamFoundation.*' -or
                    $namespace -like 'Microsoft.VisualStudio.Services' -or
                    $namespace -like 'Microsoft.VisualStudio.Services.*') {

                    $dllPaths += [System.IO.Path]::Combine($OMDirectory, "$namespace.WebApi.dll")
                    $dllPaths += [System.IO.Path]::Combine($OMDirectory, "$namespace.dll")
                }
            }
        }

        foreach ($dllPath in $dllPaths) {
            # Check whether the DLL exists.
            Write-Verbose "Testing leaf path: '$dllPath'"
            if (!(Test-Path -PathType Leaf -LiteralPath "$dllPath")) {
                Write-Verbose "Not found."
                continue
            }

            # Load the DLL.
            Write-Verbose "Loading assembly: $dllPath"
            try {
                Add-Type -LiteralPath $dllPath
            } catch {
                # Write the information to the verbose stream and proceed to attempt to load the requested type.
                #
                # The requested type may successfully load now. For example, the type used with the 14.0 Web API for the
                # federated credential (VssOAuthCredential) resides in Microsoft.VisualStudio.Services.Client.dll. Even
                # though loading the DLL results in a ReflectionTypeLoadException when Microsoft.ServiceBus.dll (approx 3.75mb)
                # is not present, enough types are loaded to use the VssOAuthCredential federated credential with the Web API
                # HTTP clients.
                Write-Verbose "$($_.Exception.GetType().FullName): $($_.Exception.Message)"
                if ($_.Exception -is [System.Reflection.ReflectionTypeLoadException]) {
                    for ($i = 0 ; $i -lt $_.Exception.LoaderExceptions.Length ; $i++) {
                        $loaderException = $_.Exception.LoaderExceptions[$i]
                        Write-Verbose "LoaderExceptions[$i]: $($loaderException.GetType().FullName): $($loaderException.Message)"
                    }
                }
            }

            # Try to load the type.
            Write-Verbose "Testing whether type can be loaded: '$TypeName'"
            $ErrorActionPreference = 'Ignore'
            try {
                # Failure when attempting to cast a string to a type, transfers control to the
                # catch handler even when the error action preference is ignore. The error action
                # is set to Ignore so the $Error variable is not polluted.
                $type = [type]$TypeName

                # Success.
                Write-Verbose "The type was loaded successfully."
                return $type
            } catch {
                $errorRecord = $_
            }

            $ErrorActionPreference = 'Stop'
            Write-Verbose "The type was not loaded."
        }

        # Check whether to propagate the error.
        if ($Require) {
            Write-Error $errorRecord
        }
    } finally {
        Trace-LeavingInvocation -InvocationInfo $MyInvocation
    }
}
