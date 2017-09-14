$maxConcurrency = 8
$jobs = @( )
$totalSlices = [int]$env:BUILD_WINDOWS_PARALLEL
while ($totalSlices -or $jobs.Count) {
    # Start up to $maxConcurrency jobs.
    while ($totalSlices -and $jobs.Count -lt $maxConcurrency) {
        $sliceNumber = $totalSlices
        $totalSlices--

        # Start a job.
        Write-Host "Starting a job to download slice '$sliceNumber'."
        $jobs += Start-Job -ScriptBlock {
            param([string]$SliceNumber)

            $ErrorActionPreference = 'Stop'
            Add-Type -Assembly 'System.IO.Compression.FileSystem'

            # Without a try block, exceptions from within .Net method calls will not bubble.
            try {
                # Download the slice.
                $downloadUrl = "$($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)$env:SYSTEM_TEAMPROJECTID/_apis/build/builds/$env:BUILD_BUILDID/artifacts?artifactName=slice-$SliceNumber&%24format=zip&api-version=3"
                $downloadTarget = "$env:SYSTEM_ARTIFACTSDIRECTORY\slice-$SliceNumber.zip"
                Write-Host "Downloading: '$downloadUrl'"
                $webClient = New-Object System.Net.WebClient
                $webClient.Headers.Add('Authorization', "Bearer $env:SYSTEM_ACCESSTOKEN")
                $webClient.DownloadFile($downloadUrl, $downloadTarget)

                # Extracting the artifact zip.
                Write-Host "Extracting artifact."
                [System.IO.Compression.ZipFile]::ExtractToDirectory($downloadTarget, $env:SYSTEM_ARTIFACTSDIRECTORY)
            } catch {
                throw $_
            }
        } -ArgumentList @(
            $sliceNumber
        )
    }

    # Wait for a job to finish.
    Write-Host 'Waiting for a job to finish.'
    $finished = Wait-Job -Job $jobs -Any

    # Remove the finished job from the array.
    $jobs = @( $jobs | Where-Object { $_ -ne $finished } )

    # Dump the job output.
    Write-Host "********************************************************************************"
    Write-Host "START JOB OUTPUT"
    Write-Host "********************************************************************************"
    $finished | Receive-Job -ErrorAction Continue 2>&1 | Out-String
    Write-Host "********************************************************************************"
    Write-Host "END JOB OUTPUT"
    Write-Host "********************************************************************************"

    # Remove the job.
    $finished | Remove-Job

    # Check if the job failed.
    if ($finished.State -ne 'Completed') {
        # Stop all other jobs.
        $jobs | Remove-Job -Force

        # Throw.
        throw "Job failed."
    }
}
