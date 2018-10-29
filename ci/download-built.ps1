# Without a try block, exceptions from within .Net method calls will not bubble.
$ErrorActionPreference = 'Stop'
Add-Type -Assembly 'System.IO.Compression.FileSystem'
try {
    # Download the package
    $downloadUrl = "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)$env:SYSTEM_TEAMPROJECTID/_apis/build/builds/$env:BUILD_BUILDID/artifacts?artifactName=package&%24format=zip&api-version=3"
    $downloadTarget = "$env:SYSTEM_ARTIFACTSDIRECTORY\package.zip"
    Write-Host "Downloading: '$downloadUrl' to target '$downloadTarget'"
    $webClient = New-Object System.Net.WebClient
    $webClient.Headers.Add('Authorization', "Bearer $env:SYSTEM_ACCESSTOKEN")
    $webClient.DownloadFile($downloadUrl, $downloadTarget)

    # Extracting the artifact zip.
    Write-Host "Extracting artifact."
    [System.IO.Compression.ZipFile]::ExtractToDirectory($downloadTarget, $env:SYSTEM_ARTIFACTSDIRECTORY)
} catch {
    throw $_
}
