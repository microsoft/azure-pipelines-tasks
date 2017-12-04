# Read job variables
$collectorName = $env:collectorName
$collectorStartTime = [System.DateTime]::Parse($env:collectorStartTime)
$jobName = $env:system_jobDisplayName

# Stop the performance monitor collector
Write-Host "Stopping collector"
& C:\Windows\System32\logman.exe stop -n $collectorName

# Upload the performance monitor data.
Write-Host "Uploading performance monitor data"
$blgFile = Get-ChildItem -LiteralPath $PSScriptRoot\.. -Filter *.blg | Select-Object -Last 1 -ExpandProperty FullName
Write-Host "##vso[artifact.upload containerfolder=perfmon;artifactname=perfmon]$blgFile"

# Upload the event logs
$logNames = @(
    "Application"
    "System"
    "Security"
)
foreach ($logName in $logNames) {
    # Dump the log to file
    Write-Host "Getting $logName event log"
    $filePath = "$PSScriptRoot\..\$jobName-$logName-event-log.txt"
    Get-WinEvent -LogName $logName |
        Where-Object { ($collectorStartTime.CompareTo(($_.TimeCreated)) -lt 0) } |
        Format-List |
        Out-File -FilePath $filePath -Encoding UTF8

    # Upload the log
    Write-Host "Uploading $logName event log"
    Write-Host "##vso[artifact.upload containerfolder=event-logs;artifactname=event-logs]$filePath"
}
