[cmdletbinding()]
param(
    [string[]]$SymbolsFilePaths = $(throw 'Missing SymbolsFilePaths'),
    [switch]$TreatNotIndexedAsWarning
)

# For pre-M88 agents, get the method info for DbgHelpWrapper.GetIndexedSources(...).
# The method info is used by the function Get-SourceFilePaths. Since reflection is
# expensive, we do this exactly once outside the scope of the function rather than
# each time the function executes.
[hashtable]$splat = @{
    'Name' = 'Get-IndexedSourceFilePaths'
    'Module' = 'Microsoft.TeamFoundation.DistributedTask.Task.Internal'
    'ErrorAction' = 'SilentlyContinue'
}
if (!(Get-Command @splat)) {
    Write-Verbose 'Command not found: Get-IndexedSourceFilePaths'
    
    # Get the dbgHelpWrapper type.
    # Because the type's access modifier is 'internal', we have to load it from
    # the assembly rather than using the PowerShell type syntax.
    [string]$taskInternalAssemblyPath =
        Get-Module -Name 'Microsoft.TeamFoundation.DistributedTask.Task.Internal' |
        Select-Object -ExpandProperty 'Path'
    $taskInternalAssembly = [System.Reflection.Assembly]::LoadFrom($taskInternalAssemblyPath)
    $dbgHelpWrapperType = $taskInternalAssembly.GetType(
        'Microsoft.TeamFoundation.DistributedTask.Task.Internal.Core.DbgHelpWrapper', #name
        $true, # throwOnError
        $false) # ignoreCase

    # Because the GetIndexedSources method's access modifier is internal, we have
    # to load it via reflection.
    $getIndexedSourcesMethodInfo = $dbgHelpWrapperType.GetMethod(
        'GetIndexedSources', # name
        [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::NonPublic) # bindingFlags
}

function Add-DbghelpLibrary {
    [cmdletbinding()]
    param()

    # Check if dbghelp.dll is already loaded.
    Write-Verbose "Checking if library is already loaded: dbghelp.dll"
    [string]$filePath = "$env:AGENT_HOMEDIRECTORY\Agent\Worker\Tools\Symstore\dbghelp.dll"
    [bool]$isLoaded = $false
    [System.Diagnostics.Process]$process = [System.Diagnostics.Process]::GetCurrentProcess();
    foreach ($module in $process.Modules) {
        if ($module.ModuleName -eq 'dbghelp.dll') {
            $isLoaded = $true
            if ($module.FileName -eq $filePath) {
                Write-Verbose "Module dbghelp.dll is already loaded from the expected file path: $filePath"
            } else {
                Write-Warning (Get-LocalizedString -Key "Library dbghelp.dll is already loaded from an unexpected file path: {0} ; Expected path: {1} ; An incorrect version of the library may result in malformed source file paths to be extracted from the PDB files. If this condition occurs, it will be indicated in the logs below." -ArgumentList $($module.FileName), $filePath)
            }

            # Don't short-circuit the loop. The module could be loaded more
            # than once and we should trace info about each loaded instance.
        }
    }

    # Short-ciruit if already loaded.
    if ($isLoaded) {
        return
    }

    # Sanity check to make sure the DLL is where we expect it.
    if (!(Test-Path -LiteralPath $filePath -PathType Leaf)) {
        throw (Get-LocalizedString -Key 'Could not find dbghelp.dll at: {0}' -ArgumentList $filePath)
    }

    # Add a type that exposes the native LoadLibrary function. If the type has
    # already been loaded once, then it is not loaded again. We don't need to
    # worry about cross task pollution here.
    Write-Verbose "Adding type: LoadLibraryWrapper"
    [string]$memberDefinition = @'
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern IntPtr LoadLibrary(string dllToLoad);
'@
    [hashtable]$splat = @{
        'Name' = 'LoadLibraryWrapper'
        'MemberDefinition' = $memberDefinition
        'Namespace' = "InvokeIndexSources"
        'Debug' = $false
    }
    Add-Type @splat
    Write-Verbose "Loading library: $filePath"
    $hModule = [InvokeIndexSources.LoadLibraryWrapper]::LoadLibrary($filePath)
    if ($hModule -eq [System.IntPtr]::Zero) {
        $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        Write-Warning (Get-LocalizedString -Key "Failed to load dbghelp.dll from location {0} ; Error code: {1}" -ArgumentList $filePath, $errorCode)
        return
    }

    $hModule
}

function Add-SourceServerStream {
    [cmdletbinding()]
    param(
        [string]$PdbStrPath = $(throw 'Missing PdbStrPath.'),
        [string]$SymbolsFilePath = $(throw 'Missing SymbolsFilePath.'),
        [string]$StreamContent = $(throw 'Missing StreamContent.')
    )

    # Create a temp file to store the stream content.
    Write-Verbose "Writing source server stream content to a temp file."
    [string]$streamContentFilePath = [System.IO.Path]::GetTempFileName()
    try {
        # Check for spaces in the temp file path.
        if ($streamContentFilePath.Contains(' ')) {
            Write-Warning (Get-LocalizedString -Key 'Source files may not be indexed properly. Temp folder contains spaces in the path. To fix the issue, set the temp folder to a path without spaces.')
            # Don't short-circuit. Just try anyway even though it will likely fail.
        }

        # For encoding consistency with previous implementation, use File.WriteAllText(...) instead
        # of Out-File.
        [System.IO.File]::WriteAllText($streamContentFilePath, $StreamContent)
        Write-Verbose "Wrote stream content to: $streamContentFilePath"

        # Store the original symbols file path.
        [string]$originalSymbolsFilePath = $SymbolsFilePath
        try {
            # Pdbstr.exe doesn't work with symbols files with a space in the path. If the symbols file
            # has a space in file path, then pdbstr.exe just prints the command usage information over
            # STDOUT. It doesn't inject the indexing info into the PDB file, doesn't write to STDERR,
            # and doesn't return a non-zero exit code.
            if ($SymbolsFilePath.Contains(' ')) {
                # Create a temp file.
                Write-Verbose "Symbols file path contains a space. Copying to a temp file."
                $SymbolsFilePath = [System.IO.Path]::GetTempFileName()

                # If the temp file contains a space in the path, then we would have already printed a
                # warning when the stream content temp file was created above. No need to check and warn
                # again here.

                # Copy the original symbols file over the temp file.
                Copy-Item -LiteralPath $originalSymbolsFilePath -Destination $SymbolsFilePath
                Write-Verbose "Copied symbols file to: $SymbolsFilePath"
            }

            # Call pdbstr.exe.
            [string[]]$pdbStrArgs = @(
                '-w'
                "-p:""$SymbolsFilePath"""
                "-i:""$streamContentFilePath"""
                '-s:srcsrv'
            )
            Write-Verbose "$PdbStrPath $pdbStrArgs"
            # Redirect STDOUT to the verbose pipeline.
            # Let STDERR output to the error pipeline.
            & $pdbstrPath $pdbStrArgs |
                ForEach-Object { Write-Verbose $_ }
            Write-Verbose "pdbstr.exe exit code: $LASTEXITCODE"

            # Copy the temp symbols file back over the original file.
            if ($SymbolsFilePath -ne $originalSymbolsFilePath) {
                Write-Verbose "Copying over the original symbols file from the temp file. Copy source: $SymbolsFilePath ; Copy target: $originalSymbolsFilePath"
                Copy-Item -LiteralPath $SymbolsFilePath -Destination $originalSymbolsFilePath
            }
        }
        finally {
            # Clean up the temp symbols file.
            if ($SymbolsFilePath -ne $originalSymbolsFilePath) {
                Write-Verbose "Deleting temp symbols file."
                Remove-Item $SymbolsFilePath
            }
        }
    }
    finally {
        # Clean up the temp stream content file.
        Write-Verbose "Deleting temp source server stream content file: $streamContentFilePath"
        Remove-Item -LiteralPath $streamContentFilePath
    }
}

function Get-SourceFilePaths {
    [cmdletbinding()]
    param(
        [string]$SymbolsFilePath = $(throw 'Missing SymbolsFilePath'),
        [string]$SourcesRootPath = $(throw 'Missing SourcesRootPath'),
        [switch]$TreatNotIndexedAsWarning
    )

    # Validate the symbols file exists.
    if (!(Test-Path -LiteralPath $SymbolsFilePath -PathType Leaf)) {
        throw (Get-LocalizedString -Key 'The file {0} could not be found.' -ArgumentList $SymbolsFilePath)
    }

    # Get the referenced source file paths.
    [string[]]$sourceFilePaths = $null
    if (!$getIndexedSourcesMethodInfo) {
        $sourceFilePaths = Get-IndexedSourceFilePaths -SymbolsFilePath $SymbolsFilePath
    } else {
        # Agent is pre-M88.
        $dbgHelpWrapper = $dbgHelpWrapperType.GetConstructors()[0].Invoke($null)
        try {
            $sourceFilePaths = $getIndexedSourcesMethodInfo.Invoke($dbgHelpWrapper, @( $SymbolsFilePath ))
        }
        finally {
            $dbgHelpWrapper.Dispose()
        }
    }

    # Warn if no source file paths were contained in the PDF file.
    if (!$sourceFilePaths) {
        [string]$message = (Get-LocalizedString -Key 'Unable to index sources for symbols file: {0} ; The file does not contain any source file paths.' -ArgumentList $SymbolsFilePath)
        if ($TreatNotIndexedAsWarning) {
            Write-Warning $message
        } else {
            Write-Host $message
        }

        return
    }

    # Make the sources root path end with a trailing slash.
    $SourcesRootPath = $SourcesRootPath.TrimEnd('\')
    $SourcesRootPath = "$SourcesRootPath\"

    [bool]$isPreambleWritten = $false
    foreach ($sourceFilePath in $sourceFilePaths) {
        # Trim the source file path.
        $sourceFilePath = $sourceFilePath.Trim()

        # Check whether the source file is under sources root.
        [bool]$isUnderSourcesRoot = $sourceFilePath.StartsWith(
            $SourcesRootPath,
            [System.StringComparison]::OrdinalIgnoreCase)

        # Check whether the source file exists.
        [bool]$isFound =
            $isUnderSourcesRoot -and
            (Test-Path -LiteralPath $sourceFilePath -PathType Leaf)

        # Warn if issues.
        if ((!$isUnderSourcesRoot) -or (!$isFound)) {
            # Warn with preamble message if the preamble has not already been printed.
            if (!$isPreambleWritten) {
                [string]$message = (Get-LocalizedString -Key 'Unable to index one or more source files for symbols file: {0}' -ArgumentList $SymbolsFilePath)
                if ($TreatNotIndexedAsWarning) {
                    Write-Warning $message
                } else  {
                    Write-Host $message
                }
            }

            # Set the flag indicating that the preamble warning has been printed.
            $isPreambleWritten = $true

            if (!$isUnderSourcesRoot) {
                # Warn that the source file path is not under the sources root.
                [string]$message = (Get-LocalizedString -Key 'The source file is not under the sources root directory. Source file: {0} ; Sources root directory: {1}' -ArgumentList $sourceFilePath, $SourcesRootPath)
                if ($TreatNotIndexedAsWarning) {
                    Write-Warning $message
                } else {
                    Write-Host $message
                }
            } elseif (!$isFound) {
                # Warn that the source file does not exist.
                [string]$message = (Get-LocalizedString -Key 'Source file not found: {0}' -ArgumentList $sourceFilePath)
                if ($TreatNotIndexedAsWarning) {
                    Write-Warning $message
                } else {
                    Write-Host $message
                }
            } else {
                throw 'Not supported' # Execution should never reach here.
            }

            # Prevent the source file path from being output.
            continue
        }

        # Output the source file path.
        $sourceFilePath
    }
}

function New-TfsGitSrcSrvIniContent {
    [cmdletbinding()]
    param(
        [string]$CollectionUrl = $(throw 'Missing CollectionUrl'),
        [string]$TeamProjectId = $(throw 'Missing TeamProjectId'),
        [string]$RepoId = $(throw 'Missing RepoId'),
        [string]$CommitId = $(throw 'Missing CommitId'),
        [string]$SourcesRootPath = $(throw 'Missing SourcesRootPath'),
        [string[]]$SourceFilePaths = $(throw 'Missing SourceFilePaths')
    )

    # For more information, see:
    # https://msdn.microsoft.com/en-us/library/windows/hardware/ff558876(v=vs.85).aspx
    # https://msdn.microsoft.com/en-us/library/windows/desktop/ms680641(v=vs.85).aspx
    # http://www.codeproject.com/Articles/115125/Source-Indexing-and-Symbol-Servers-A-Guide-to-Easi
    'SRCSRV: ini ------------------------------------------------'
    'VERSION=3'
    'INDEXVERSION=2'
    'VERCTRL=Team Foundation Server'
    [string]::Format(
        [System.Globalization.CultureInfo]::InvariantCulture,
        'DATETIME={0:ddd MMM dd HH:mm:ss yyyy}',
        (Get-Date))
    'INDEXER=TFSTB'
    'SRCSRV: variables ------------------------------------------'
    # Assigning values to variables in the variables section - e.g. the variable
    # TFS_COLLECTION - allows for the variable to be overridden at debugging time.
    # For example, if the source code moves to a different collection URL altogether,
    # then at debugging time the TFS_COLLECTION variable can be overridden.
    #
    # Use the short commit hash in the target file path to alleviate max path issues.
    "TFS_EXTRACT_TARGET=%targ%\%var5%\%fnvar%(%var6%)%fnbksl%(%var7%)"
    # The "commitId" arg requires the full commit ID.
    #
    # The /applyfilters switch indicates whether to conver LF to CRLF. The source file hashes are
    # embedded in the PDB files and the debugger will reject the source file as a match if the
    # downloaded file's hash doesn't match the hash embedded in the PDB file. We make the assumption
    # the PDB was built from a source file with CRLFs. In some edge case were this is not true, the
    # variable TFS_APPLY_FILTERS can be overridden at debugging time.
    "TFS_EXTRACT_CMD=tf.exe git view /collection:%fnvar%(%var2%) /teamproject:""%fnvar%(%var3%)"" /repository:""%fnvar%(%var4%)"" /commitId:%fnvar%(%var5%) /path:""%var7%"" /output:%SRCSRVTRG% %fnvar%(%var8%)"
    "TFS_COLLECTION=$CollectionUrl"
    "TFS_TEAM_PROJECT=$TeamProjectId"
    "TFS_REPO=$RepoId"
    "TFS_COMMIT=$CommitId"
    "TFS_SHORT_COMMIT=$($CommitId.Substring(0, 8))" # Take the first 8 chars only.
    "TFS_APPLY_FILTERS=/applyfilters"
    'SRCSRVVERCTRL=git'
    'SRCSRVERRDESC=access'
    'SRCSRVERRVAR=var2'
    'SRCSRVTRG=%TFS_EXTRACT_TARGET%'
    'SRCSRVCMD=%TFS_EXTRACT_CMD%'
    'SRCSRV: source files ---------------------------------------'
    # Make the sources root path end with a trailing slash.
    $SourcesRootPath = $SourcesRootPath.TrimEnd('\')
    $SourcesRootPath = "$SourcesRootPath\"
    foreach ($sourceFilePath in $SourceFilePaths) {
        [string]$relativeSourceFilePath = $sourceFilePath.Substring($SourcesRootPath.Length)
        $relativeSourceFilePath = $relativeSourceFilePath.Replace('\', '/')
        $relativeSourceFilePath = "/$relativeSourceFilePath"
        "$sourceFilePath*TFS_COLLECTION*TFS_TEAM_PROJECT*TFS_REPO*TFS_COMMIT*TFS_SHORT_COMMIT*$relativeSourceFilePath*TFS_APPLY_FILTERS"
    }

    'SRCSRV: end ------------------------------------------------'
}

function New-TfsVersionControlSrcSrvIniContent {
    [cmdletbinding()]
    param(
        [string]$PublicCollectionUrl = $(throw 'Missing PublicCollectionUrl'),
        $Workspace = $(throw 'Missing Workspace'),
        [string[]]$SourceFilePaths = $(throw 'Missing SourceFilePaths')
    )

    'SRCSRV: ini ------------------------------------------------'
    'VERSION=3'
    'INDEXVERSION=2'
    'VERCTRL=Team Foundation Server'
    [string]::Format(
        [System.Globalization.CultureInfo]::InvariantCulture,
        'DATETIME={0:ddd MMM dd HH:mm:ss yyyy}',
        (Get-Date))
    'INDEXER=TFSTB'
    'SRCSRV: variables ------------------------------------------'
    'TFS_EXTRACT_CMD=tf.exe view /version:%var4% /noprompt "$%var3%" /server:%fnvar%(%var2%) /console > %SRCSRVTRG%'
    'TFS_EXTRACT_TARGET=%targ%\%var2%%fnbksl%(%var3%)\%var4%\%fnfile%(%var5%)'
    'SRCSRVVERCTRL=tfs'
    'SRCSRVERRDESC=access'
    'SRCSRVERRVAR=var2'
    "VSTFSSERVER=$PublicCollectionUrl"
    'SRCSRVTRG=%TFS_EXTRACT_TARGET%'
    'SRCSRVCMD=%TFS_EXTRACT_CMD%'
    'SRCSRV: source files ---------------------------------------'
    $itemSpecs =
        $SourceFilePaths |
        ForEach-Object { New-Object -TypeName 'Microsoft.TeamFoundation.VersionControl.Client.ItemSpec' -ArgumentList $_, 'None' }
    # The type returned by GetLocalVersions(...) is LocalVersion[][].
    $localVersions = $Workspace.GetLocalVersions(
        $itemSpecs, # itemSpecs
        $false); # sortData
    foreach ($localVersion in $localVersions) {
        if (!$localVersion) {
            continue
        }

        [string]$localPath = $localVersion[0].Item
        Write-Verbose "Local path: $localPath"
        [string]$serverPath = $Workspace.GetServerItemForLocalItem($localPath).Substring(1) # Everything but the '$'.
        [int]$version = $localVersion[0].Version
        [string]$fileName = Split-Path -Leaf -Path $localPath
        "$localPath*VSTFSSERVER*$serverPath*$version*$fileName"
    }
    
    'SRCSRV: end ------------------------------------------------'
}

function Remove-DbghelpLibrary {
    [cmdletbinding()]
    param(
        $hModule
    )

    Write-Verbose "Adding type: FreeLibraryWrapper."
    # Add a type that exposes the native FreeLibrary function. If the type has
    # already been loaded once, then it is not loaded again. We don't need to
    # worry about cross task pollution here.
    [string]$memberDefinition = @'
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool FreeLibrary(IntPtr hModule);
'@
    [hashtable]$splat = @{
        'Name' = 'FreeLibraryWrapper'
        'MemberDefinition' = $memberDefinition
        'Namespace' = "InvokeIndexSources"
        'Debug' = $false
    }
    Add-Type @splat
    Write-Verbose "Unloading library: dbghelp.dll"
    if (![InvokeIndexSources.FreeLibraryWrapper]::FreeLibrary($hModule)) {
        $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        Write-Warning (Get-LocalizedString -Key "Failed to free library dbghelp.dll. Error code: {0}" -ArgumentList $errorCode)
    }
}

# Validate at least one symbols file.
if (!$SymbolsFilePaths) {
    Write-Warning (Get-LocalizedString -Key 'No files were selected for indexing.');
    return
}

# Resolve location of pdbstr.exe.
[string]$pdbstrPath = Get-ToolPath -Name 'Pdbstr\pdbstr.exe'
if (!$pdbstrPath) {
    throw (Get-LocalizedString -Key 'Could not find pdbstr.exe')
}

# Set source provider information.
[string]$provider = $env:BUILD_REPOSITORY_PROVIDER
[string]$teamProjectId = $env:SYSTEM_TEAMPROJECTID
[string]$sourcesRootPath = $env:BUILD_SOURCESDIRECTORY

# For consistency with the previous implementation, set the working directory to the temp folder
# before calling pdbstr.exe.
Push-Location $env:TEMP
$dbghelpModuleHandle = $null
$tfsTeamProjectCollection = $null
try {
    # Load dbghelp.dll if it is not already loaded.
    $dbghelpModuleHandle = Add-DbghelpLibrary

    # Set the provider specific information.
    switch ($provider) {
        'TfsGit' {
            [string]$collectionUrl = "$env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI".TrimEnd('/')
            [string]$repoId = $env:BUILD_REPOSITORY_ID
            if (!$repoId) {
                # BUILD_REPOSITORY_ID was added in M88. Fallback to name if not available.
                $repoId = $env:BUILD_REPOSITORY_NAME # Get the referenced source files.
            }

            [string]$commitId = $env:BUILD_SOURCEVERSION
            break
        }
        'TfsVersionControl' {
            # TODO: WHERE DOES THE distributedTaskContext VARIABLE COME FROM? GLOBAL SCOPE? AGENT SETS THIS?
            $serviceEndpoint = Get-ServiceEndpoint -Context $distributedTaskContext -Name $env:BUILD_REPOSITORY_NAME
            [hashtable]$splat = @{
                'Name' = 'Get-TfsClientCredentials'
                'Module' = 'Microsoft.TeamFoundation.DistributedTask.Task.Internal'
                'ErrorAction' = 'SilentlyContinue'
            }
            if (Get-Command @splat) {
                $tfsClientCredentials = Get-TfsClientCredentials -ServiceEndpoint $serviceEndpoint
            } else {
                # For pre-M88 agents, get the TFS client credentials in a hacky way.
                Write-Verbose 'Command not found: Get-TfsClientCredentials'
                [System.Reflection.Assembly]::LoadFrom("$env:AGENT_HOMEDIRECTORY\Agent\Worker\Microsoft.TeamFoundation.DistributedTask.Agent.Common.dll") | Out-Null
                $tfsClientCredentials =
                    [Microsoft.TeamFoundation.DistributedTask.Agent.Common.CredentialsExtensions]::GetTfsClientCredentials(
                        $serviceEndpoint)
            }

            [System.Reflection.Assembly]::LoadFrom("$env:AGENT_HOMEDIRECTORY\Agent\Worker\Microsoft.TeamFoundation.Client.dll") | Out-Null
            [System.Reflection.Assembly]::LoadFrom("$env:AGENT_HOMEDIRECTORY\Agent\Worker\Microsoft.TeamFoundation.Common.dll") | Out-Null
            [System.Reflection.Assembly]::LoadFrom("$env:AGENT_HOMEDIRECTORY\Agent\Worker\Microsoft.TeamFoundation.VersionControl.Client.dll") | Out-Null
            $tfsTeamProjectCollection = New-Object Microsoft.TeamFoundation.Client.TfsTeamProjectCollection(
                $serviceEndpoint.Url,
                $tfsClientCredentials)
            $versionControlServer = $tfsTeamProjectCollection.GetService([Microsoft.TeamFoundation.VersionControl.Client.VersionControlServer])
            $workspace = $versionControlServer.TryGetWorkspace($sourcesRootPath)
            if (!$workspace) {
                # TODO: SHOULDN'T THIS BE AN ERROR? THIS SHOULD NEVER HAPPEN.
                Write-Warning (Get-LocalizedString -Key 'Unable to determine workspace from source folder ''{0}''.' -ArgumentList $sourcesRootPath)
                return
            }

            # When the build service runs on the same box as the AT, we use localhost
            # to connect to the AT.  This is not appropriate for storing inside of a PDB that will
            # be used on another box, so we have to look up a more durable URL.
            $locationService = $tfsTeamProjectCollection.GetService([Microsoft.TeamFoundation.Framework.Client.ILocationService])
            # Retrieve a URI to the location service.
            [string]$publicCollectionUrl = $locationService.LocationForAccessMapping(
                [Microsoft.TeamFoundation.ServiceInterfaces]::LocationService,
                [Microsoft.TeamFoundation.Framework.Common.LocationServiceConstants]::SelfReferenceLocationServiceIdentifier,
                $locationService.DefaultAccessMapping)
            # Remove the location service part to form a collection URI.
            if ($publicCollectionUrl.EndsWith(
                    [Microsoft.TeamFoundation.Framework.Common.LocationServiceConstants]::CollectionLocationServiceRelativePath,
                    [System.StringComparison]::OrdinalIgnoreCase)) {
                $publicCollectionUrl = $publicCollectionUrl.Substring(
                    0,
                    $publicCollectionUrl.Length - [Microsoft.TeamFoundation.Framework.Common.LocationServiceConstants]::CollectionLocationServiceRelativePath.Length)
            } else {
                # TODO: SHOULD THIS REVERT TO ENV VAR?
            }

            break
        }
        default {
            Write-Warning (Get-LocalizedString -Key 'Only TfsGit and TfsVersionControl source providers are supported for source indexing. Repository type: {0}' -ArgumentList $provider)
            Write-Warning (Get-LocalizedString -Key 'Unable to index sources.')
            return
        }
    }

    # Index the source files
    foreach ($symbolsFilePath in $SymbolsFilePaths) {
        Write-Verbose "Symbols file: $symbolsFilePath"

        # Get the source file paths embedded in the symbols file.
        [hashtable]$splat = @{
            'SymbolsFilePath' = $symbolsFilePath
            'SourcesRootPath' = $sourcesRootPath
            'TreatNotIndexedAsWarning' = $TreatNotIndexedAsWarning
        }
        [string[]]$sourceFilePaths =
            Get-SourceFilePaths @splat |
            ForEach-Object {
                Write-Verbose "Source file: $_"
                $_
            }
        if (!$sourceFilePaths) {
            continue
        }

        # Get the content for the source server INI file.
        switch ($provider) {
            'TfsGit' {
                [hashtable]$splat = @{
                    # TODO: WHY DOESN'T THIS USE THE "PUBLIC COLLECTION URL" LIKE TFVC?
                    'CollectionUrl' = $collectionUrl
                    'TeamProjectId' = $teamProjectId
                    'RepoId' = $repoId
                    'CommitId' = $commitId
                    'SourcesRootPath' = $sourcesRootPath
                    'SourceFilePaths' = $sourceFilePaths
                }
                [string[]]$srcSrvIniContent = New-TfsGitSrcSrvIniContent @splat
                break
            }
            'TfsVersionControl' {
                [hashtable]$splat = @{
                    'PublicCollectionUrl' = $publicCollectionUrl
                    'Workspace' = $workspace
                    'SourceFilePaths' = $sourceFilePaths
                }
                [string[]]$srcSrvIniContent = New-TfsVersionControlSrcSrvIniContent @splat
                break
            }
            default {
                throw 'Not supported.' # Execution should never reach here.
            }
        }

        # For consistency with previous implementation, append a blank line so that the content
        # gets written with a trailing new-line.
        $srcSrvIniContent += ''
        [string]$srcSrvIniContent = [string]::Join([System.Environment]::NewLine, $srcSrvIniContent)

        # Add the source server info to the symbols file.
        Add-SourceServerStream -PdbStrPath $pdbstrPath -SymbolsFilePath $symbolsFilePath -StreamContent $srcSrvIniContent
    }
}
finally {
    if ($tfsTeamProjectCollection) {
        Write-Verbose 'Disposing tfsTeamProjectCollection'
        $tfsTeamProjectCollection.Dispose()
    }

    if ($dbghelpModuleHandle) {
        Remove-DbghelpLibrary $dbghelpModuleHandle
    }
}