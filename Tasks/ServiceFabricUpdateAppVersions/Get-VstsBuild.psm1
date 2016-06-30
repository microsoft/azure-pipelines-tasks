function Get-VstsBuild
{
    [CmdletBinding()]
    [OutputType([string])]
    Param
    (
        [Parameter(Mandatory=$true)]
        [ValidateNotNullOrEmpty()]
        [string]
        $PkgArtifactName,

        [Parameter(Mandatory=$true)]
        [ValidateSet("Specific", "LastSuccessful")]
        [string]
        $CompareType,

        [string]
        $BuildNumber
    )

    Trace-VstsEnteringInvocation $MyInvocation
    try {
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
            elseif ($artifact.resource.type -eq "container") # The artifact is in a hosted server and must be downloaded into a temp folder
            {
                $agentTmpFolder = Join-Path (Get-VstsTaskVariable -Name Agent.WorkFolder -Require) "tmp"
                $artifactZipFile = Join-Path $agentTmpFolder "$PkgArtifactName.zip"
                $artifactPath = Join-Path $agentTmpFolder $PkgArtifactName

                if (Test-Path $artifactPath)
                {
                    # If a previous artifact with the same name was already downloaded to the agent's temp folder, delete it
                    Remove-Item $artifactPath -Recurse -Force | Out-Null
                }
                elseif (!(Test-Path $agentTmpFolder))
                {
                    # Create the agent's temp folder if it doesn't exist
                    New-Item $agentTmpFolder -ItemType Directory | Out-Null
                }

                Write-Host (Get-VstsLocString -Key DownloadingArtifact -ArgumentList $PkgArtifactName)

                # Download the artifact to the agent's temp folder and unzip it
                Invoke-WebRequest -Uri $artifact.resource.downloadUrl -Headers $authHeader -OutFile $artifactZipFile

                Add-Type -AssemblyName System.IO.Compression.FileSystem
                [System.IO.Compression.ZipFile]::ExtractToDirectory("$artifactZipFile", "$agentTmpFolder")

                # return the temp path to the artifact
                $artifactPath
            }
            else
            {
                throw (Get-VstsLocString -Key UnrecognizedArtifactType -ArgumentList $artifact.resource.type)
            }
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
