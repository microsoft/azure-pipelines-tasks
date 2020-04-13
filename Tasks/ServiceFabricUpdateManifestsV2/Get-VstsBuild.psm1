function Get-VstsBuild
{
    [CmdletBinding()]
    [OutputType([string])]
    Param
    (
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]
        $PkgArtifactName,

        [Parameter(Mandatory = $true)]
        [boolean]
        $OverwritePkgArtifact,

        [Parameter(Mandatory = $true)]
        [ValidateSet("Specific", "LastSuccessful")]
        [string]
        $CompareType,

        [string]
        $BuildNumber
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try
    {
        $vstsEndpoint = Get-VstsEndpoint -Name SystemVssConnection -Require
        $authHeader = @{ Authorization = "Bearer $($vstsEndpoint.auth.parameters.AccessToken)" }
        $projectId = Get-VstsTaskVariable -Name System.TeamProjectId -Require
        $apiVersion = "api-version=2.0"
        $definition = "definitions=$(Get-VstsTaskVariable -Name System.DefinitionId -Require)"

        if ($CompareType -eq "Specific")
        {
            if ([string]::IsNullOrEmpty($BuildNumber))
            {
                throw (Get-VstsLocString -Key BuildNumberNotSpecified)
            }

            $escapedBuildNumber = [System.Uri]::EscapeDataString($BuildNumber)

            # Query for a specific build number (regardless of build status or result)
            $url = "$($vstsEndpoint.url)$projectId/_apis/build/builds?$apiVersion&$definition&buildNumber=$escapedBuildNumber&`$top=1"
        }
        else
        {
            # Query for the last successful, completed build
            $url = "$($vstsEndpoint.url)$projectId/_apis/build/builds?$apiVersion&$definition&statusFilter=completed&resultFilter=succeeded&`$top=1"
        }

        $build = (Invoke-RestMethod -Uri $url -Headers $authHeader).Value

        if ($build)
        {
            Write-Host (Get-VstsLocString -Key PreviousBuildNumberLabel -ArgumentList $build.buildNumber)

            $escapedArtifactName = [System.Uri]::EscapeDataString($PkgArtifactName)
            $url = "$($vstsEndpoint.url)$projectId/_apis/build/builds/$($build.Id)/artifacts?$apiVersion&artifactName=$escapedArtifactName"
            $artifact = Invoke-RestMethod -Uri $url -Headers $authHeader

            if ($artifact.resource.type -eq "filepath") # The artifact is a network path so just return that path
            {
                Join-Path $artifact.resource.data $PkgArtifactName
            }
            elseif ($artifact.resource.type -eq "container" -or $artifact.resource.type -eq "PipelineArtifact") # The artifact is in a hosted server and must be downloaded into a temp folder
            {
                Import-Module $PSScriptRoot\ps_modules\PowershellHelpers
                $agentTmpFolder = Join-Path (Get-TempDirectoryPath) $build.buildNumber
                $artifactZipFile = Join-Path $agentTmpFolder "$PkgArtifactName.zip"
                $artifactPath = Join-Path $agentTmpFolder $PkgArtifactName
                $downloadArtifact = $true

                if (Test-Path -LiteralPath $artifactPath)
                {
                    if ($OverwritePkgArtifact -eq $true)
                    {
                        # If a previous artifact with the same name was already downloaded to the agent's temp folder, delete it
                        Remove-Item -LiteralPath $artifactPath -Recurse -Force | Out-Null
                    }
                    else
                    {
                        # Use prior download of artifact
                        $downloadArtifact = $false
                    }
                }
                elseif (!(Test-Path -LiteralPath $agentTmpFolder))
                {
                    # Create the agent's temp folder if it doesn't exist
                    New-Item $agentTmpFolder -ItemType Directory | Out-Null
                }

                if ($downloadArtifact -eq $true)
                {
                    Write-Host (Get-VstsLocString -Key DownloadingArtifact -ArgumentList $PkgArtifactName)

                    # Download the artifact to the agent's temp folder and unzip it
                    Get-FileWithProgress $artifact.resource.downloadUrl $artifactZipFile $authHeader["Authorization"]

                    Write-Host (Get-VstsLocString -Key FinishedDownloadingArtifact -ArgumentList $PkgArtifactName)

                    Add-Type -AssemblyName System.IO.Compression.FileSystem
                    [System.IO.Compression.ZipFile]::ExtractToDirectory("$artifactZipFile", "$agentTmpFolder")
                }

                # return the temp path to the artifact
                $artifactPath
            }
            else
            {
                throw (Get-VstsLocString -Key UnrecognizedArtifactType -ArgumentList $artifact.resource.type)
            }
        }
    }
    finally
    {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-FileWithProgress
{
    [CmdletBinding()]
    Param
    (
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]
        $Url,

        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]
        $FileName,

        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string]
        $AuthorizationHeader
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try
    {
        $webClient = New-Object System.Net.WebClient

        try
        {
            $webClient.Headers.Add("Authorization", $AuthorizationHeader)

            $global:timer = [System.Diagnostics.Stopwatch]::StartNew()

            Register-ObjectEvent -InputObject $webClient -EventName DownloadProgressChanged -Action {
                # Report progress every 10 seconds
                if ($global:timer.Elapsed.Seconds -gt 10)
                {
                    # For some reason 'TotalBytesToReceive' always reports '-1' and 'ProgressPercentage' reports '0'
                    # We'll do the best we can and at least report the bytes received
                    Write-Host (Get-VstsLocString -Key DownloadingArtifactProgress -ArgumentList $EventArgs.BytesReceived)
                    $global:timer.Restart()
                }
            } | Out-Null

            Register-ObjectEvent $webClient DownloadFileCompleted -SourceIdentifier FinishedDownload

            # This is much faster than using 'Invoke-WebRequest'
            # I tested on a 69MB zip file and it went from over 5 minutes (and failing) to about 50 seconds
            $webClient.DownloadFileAsync($Url, $FileName)

            Wait-Event -SourceIdentifier FinishedDownload | Out-Null
        }
        finally
        {
            $webClient.Dispose()
            Remove-Event -SourceIdentifier FinishedDownload
            Unregister-Event -SourceIdentifier FinishedDownload
        }
    }
    finally
    {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

Export-ModuleMember -Function Get-VstsBuild