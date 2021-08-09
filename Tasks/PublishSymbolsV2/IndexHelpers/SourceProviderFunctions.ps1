function Get-SourceProvider {
    [CmdletBinding()]
    param(
        [string]$SourcesRootPath,
        [switch]$ResolveGitSource
	)

    Trace-VstsEnteringInvocation $MyInvocation
    $provider = @{
        Name = Get-VstsTaskVariable -Name 'Build.Repository.Provider' -Require
        SourcesRootPath = Get-VstsTaskVariable -Name 'Build.SourcesDirectory' -Require
        TeamProjectId = Get-VstsTaskVariable -Name 'System.TeamProjectId' -Require
    }
	if($SourcesRootPath) {
		$provider.SourcesRootPath = $SourcesRootPath
	}
    $success = $false
    try {
        if ($provider.Name -eq 'TfsGit') {
            $provider.CollectionUrl = (Get-VstsTaskVariable -Name 'System.TeamFoundationCollectionUri' -Require).TrimEnd('/')

            $SourceResolved = $false
            if($ResolveGitSource.IsPresent) {
                try {
                    Write-Host "Trying to retrieve repository id and commit id from source path ""$(provider.SourcesRootPath)""..."
                    $provider.CommitId = git -C "$(provider.SourcesRootPath)" rev-parse HEAD
                    if($LastExitCode -eq 0 -and ![string]::IsNullOrWhiteSpace($provider.CommitId)) {
                        $remoteGitUrl = git -C "$(provider.SourcesRootPath)" remote get-url origin
                        if($LastExitCode -eq 0 -and ![string]::IsNullOrWhiteSpace($remoteGitUrl)) {
                            $apiUrl = "$($provider.CollectionUrl)/_apis/git/repositories"

                            try {
                                Write-Host "Retrieving data for all repositories of TFS collection ""$($provider.CollectionUrl)""..."
                                $clntRestApi = New-Object System.Net.WebClient
                                Write-Host "Downloading REST-Api definition data from ""$apiUrl""..."
                                $clntRestApi.UseDefaultCredentials = $true
                                $strJsonDefinitions = $clntRestApi.DownloadString($apiUrl)
                                Write-Host "Downloading complete, parsing JSON response data..."
                                $jsonDefinition = ConvertFrom-Json $strJsonDefinitions `
                                                    | where { $_.PSObject.Properties.Name -contains "value" } `
                                                    | Select-Object -ExpandProperty value `
                                                    | where { $_.PSObject.Properties.Name -contains "id" -and $_.PSObject.Properties.Name -contains "name" `
                                                                -and $_.PSObject.Properties.Name -contains "remoteUrl" -and $_.PSObject.Properties.Name -contains "project" `
                                                                -and $_.project.PSObject.Properties.Name -contains "id" }
                        
                                if($jsonDefinition -and $jsonDefinition.Count -gt 0) {
                                    Write-Host "JSON response data parsed successfully, found $($jsonDefinition.Count) repository definitions"

                                    Write-Host "Searching for repository with remote url ""$remoteGitUrl"""
                                    $jsonEntry = $jsonDefinition | where { $_.remoteUrl -eq $remoteGitUrl -and $_.project.id -eq $provider.TeamProjectId } | select -First 1

                                    if(!$jsonEntry) {
                                        Write-Host "Did not find any repository with remote url ""$remoteGitUrl"" in team project with id $($provider.TeamProjectId)"
                                        $LastIdx = $remoteGitUrl.LastIndexOf("/")
                                        if($LastIdx -ge 0 -and $LastIdx -lt $remoteGitUrl.Length) {
                                            $RepoName = $remoteGitUrl.Substring($LastIdx+1)
                                            if(![string]::IsNullOrWhiteSpace($RepoName)) {
                                                $jsonEntry = $jsonDefinition | where { $_.name -eq $RepoName -and $_.project.id -eq $provider.TeamProjectId } | select -First 1

                                                if($jsonEntry) {
                                                    Write-Host "Found repository with name ""$RepoName"" in team project with id $($provider.TeamProjectId)"
                                                }
                                                else {
                                                    Write-Warning "Did not find any repository with name ""$RepoName"" in team project with id $($provider.TeamProjectId)"
                                                }
                                            }
                                            else {
                                                Write-Warning "Retrieved repository name from remote git url was empty"
                                            }
                                        }
                                        else {
                                            Write-Warning "Unable to retrieve repository name from remote git url"
                                        }
                                    }
                                    else {
                                        Write-Host "Found repository with remote url ""$remoteGitUrl"" in team project with id $($provider.TeamProjectId)"
                                    }

                                    if($jsonEntry) {
                                        $provider.RepoId = $jsonEntry.id
                                        Write-Host "Successfully retrieved repository and commit data!"
                                        Write-Host "Repository name: ""$($jsonEntry.name)"""
                                        Write-Host "Repository id: $($provider.RepoId)"
                                        Write-Host "Commit id: $($provider.CommitId)"
                                        $SourceResolved = $true
                                    }
                                    else {
                                        Write-Warning "Did not find repository data for remote url ""$remoteGitUrl"""
                                    }
                                }
                                else {
                                    Write-Warning "Could not parse JSON data successfully or no repositories found"
                                }
                            }
                            catch {
                                Write-Warning "Error downloading definition data from ""$apiUrl"""
                            }
                        }
                        else {
                            Write-Warning "Could not retrieve valid git remote url for source path (source path needs to be git repository)"
                        }
                    }
                    else {
                        Write-Warning "Could not retrieve valid git commit id for source path (source path needs to be git repository)"
                    }
                }
                catch {
                    Write-Warning "Unexpected error encountered while trying to retrieve repository data for remote git url: $($_.Exception.Message)"
                }
            }

            if(!$SourceResolved) {
                if($ResolveGitSource.IsPresent) {
                    Write-Warning "Was unable to resolve git source, will use general repository and commit instead"
                }
				$provider.RepoId = Get-VstsTaskVariable -Name 'Build.Repository.Id' -Require
				$provider.CommitId = Get-VstsTaskVariable -Name 'Build.SourceVersion' -Require
            }			
			
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
