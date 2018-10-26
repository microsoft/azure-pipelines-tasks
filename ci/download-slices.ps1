# Without a try block, exceptions from within .Net method calls will not bubble.
try {
    # Download the slice.
    # TODO - remove references to slice number
    $downloadUrl = "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)$env:SYSTEM_TEAMPROJECTID/_apis/build/builds/$env:BUILD_BUILDID/artifacts?artifactName=slice-1&%24format=zip&api-version=3"
    $downloadTarget = "$env:SYSTEM_ARTIFACTSDIRECTORY\slice-1.zip"
    Write-Host "Downloading: '$downloadUrl'"
    $webClient = New-Object System.Net.WebClient
    $webClient.Headers.Add('Authorization', "Bearer $env:SYSTEM_ACCESSTOKEN")
    $webClient.DownloadFile($downloadUrl, $downloadTarget)

    # Extracting the artifact zip.
    Write-Host "Extracting artifact."
    [System.IO.Compression.ZipFile]::ExtractToDirectory($downloadTarget, $env:SYSTEM_ARTIFACTSDIRECTORY)
} catch {
    throw "Failed to download build artifact"
}
