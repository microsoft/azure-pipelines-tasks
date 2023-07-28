function Get-SourceProvider {
    [CmdletBinding()]
    param()

    Trace-VstsEnteringInvocation $MyInvocation
    $provider = @{
        Name = Get-VstsTaskVariable -Name 'Build.Repository.Provider' -Require
        SourcesRootPath = Get-VstsTaskVariable -Name 'Build.SourcesDirectory' -Require
        TeamProjectId = Get-VstsTaskVariable -Name 'System.TeamProjectId' -Require
    }
    $success = $false
    try {
        if ($provider.Name -eq 'TfsGit') {
            $provider.CollectionUrl = (Get-VstsTaskVariable -Name 'System.TeamFoundationCollectionUri' -Require).TrimEnd('/')
            $provider.RepoId = Get-VstsTaskVariable -Name 'Build.Repository.Id' -Require
            $provider.CommitId = Get-VstsTaskVariable -Name 'Build.SourceVersion' -Require
            $success = $true
            return New-Object psobject -Property $provider
        }
        
        if ($provider.Name -eq 'TfsVersionControl') {
            $versionControlServer = Get-VstsTfsService -TypeName 'Microsoft.TeamFoundation.VersionControl.Client.VersionControlServer'
            $provider.Workspace = $versionControlServer.TryGetWorkspace($provider.SourcesRootPath)
            if (!$provider.Workspace) {
                Write-Verbose "Unable to determine workspace from source folder: $($provider.SourcesRootPath)"
                Write-Verbose "Attempting to resolve workspace recursively from locally cached info."
                $workspaceInfos = [Microsoft.TeamFoundation.VersionControl.Client.Workstation]::Current.GetLocalWorkspaceInfoRecursively($provider.SourcesRootPath);
                if ($workspaceInfos) {
                    foreach ($workspaceInfo in $workspaceInfos) {
                        Write-Verbose "Cached workspace info discovered. Server URI: $($workspaceInfo.ServerUri) ; Name: $($workspaceInfo.Name) ; Owner Name: $($workspaceInfo.OwnerName)"
                        try {
                            $provider.Workspace = $versionControlServer.GetWorkspace($workspaceInfo)
                            break
                        } catch {
                            Write-Verbose "Determination failed. Exception: $_"
                        }
                    }
                }
            }

            if (!$provider.Workspace) {
                Write-Verbose "Attempting to resolve workspace by name."
                try {
                    $provider.Workspace = $versionControlServer.GetWorkspace(
                        (Get-VstsTaskVariable -Name 'Build.Repository.Tfvc.Workspace' -Require),
                        '.')
                } catch [Microsoft.TeamFoundation.VersionControl.Client.WorkspaceNotFoundException] {
                    Write-Verbose "Workspace not found."
                } catch {
                    Write-Verbose "Determination failed. Exception: $_"
                }
            }

            if (!$provider.Workspace) {
                Write-Warning (Get-VstsLocString -Key 'UnableToDetermineWorkspaceFromSourceFolder0' -ArgumentList $provider.SourcesRootPath)
                return
            }

            # When the build service runs on the same box as the AT, we use localhost
            # to connect to the AT.  This is not appropriate for storing inside of a PDB that will
            # be used on another box, so we have to look up a more durable URL.
            $locationService = Get-VstsTfsService -TypeName 'Microsoft.TeamFoundation.Framework.Client.ILocationService'
            # Retrieve a URI to the location service.
            $provider.PublicCollectionUrl = [string]$locationService.LocationForAccessMapping(
                [Microsoft.TeamFoundation.ServiceInterfaces]::LocationService,
                [Microsoft.TeamFoundation.Framework.Common.LocationServiceConstants]::SelfReferenceLocationServiceIdentifier,
                $locationService.DefaultAccessMapping)
            # Remove the location service part to form a collection URI.
            if ($provider.PublicCollectionUrl.EndsWith(
                    [Microsoft.TeamFoundation.Framework.Common.LocationServiceConstants]::CollectionLocationServiceRelativePath,
                    [System.StringComparison]::OrdinalIgnoreCase)) {
                $provider.PublicCollectionUrl = $provider.PublicCollectionUrl.Substring(
                    0,
                    $provider.PublicCollectionUrl.Length - [Microsoft.TeamFoundation.Framework.Common.LocationServiceConstants]::CollectionLocationServiceRelativePath.Length)
            } else {
                # TODO: SHOULD THIS REVERT TO ENV VAR?
            }

            $success = $true
            return New-Object psobject -Property $provider
        }

        Write-Warning (Get-VstsLocString -Key UnsupportedSourceProvider0 -ArgumentList $provider.Name)
        Write-Warning (Get-VstsLocString -Key UnableToIndexSources)
        return
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
