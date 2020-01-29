# Setup job variables
$collectorName = "vsts-tasks"
Write-Host "##vso[task.setvariable variable=collectorName]$collectorName"
Write-Host "##vso[task.setvariable variable=collectorStartTime]$([System.DateTime]::UtcNow.ToString("O"))"
$jobName = $env:system_jobDisplayName

# Remove any previously created collector
Write-Host "Deleting collector"
& C:\Windows\System32\logman.exe delete -n $collectorName

# Create the collector
Write-Host "Creating collector"
$counters = @(
    "\FileSystem Disk Activity(_Total)\FileSystem Bytes Read"
    "\FileSystem Disk Activity(_Total)\FileSystem Bytes Written"
    "\Memory\Available MBytes"
    "\Memory\Pages/sec"
    "\PhysicalDisk(_Total)\Avg. Disk Read Queue Length"
    "\PhysicalDisk(_Total)\Avg. Disk Write Queue Length"
    "\PhysicalDisk(_Total)\Disk Read Bytes/sec"
    "\PhysicalDisk(_Total)\Disk Write Bytes/sec"
    "\Process(_Total)\Page Faults/sec"
    "\Process(_Total)\Working Set"
    "\Processor Information(_Total)\% of Maximum Frequency"
    "\Processor Information(_Total)\% Processor Time"
)
$maxSize = "1000" # 1,000 mb
& C:\Windows\System32\logman.exe create counter -n $collectorName -c @counters -o "$PSScriptRoot\..\performance-monitors-$jobName-$('{0:yyyyMMdd-hhmmss}' -f ([System.DateTime]::Now))" -v nnnnnn -f bin -max $maxSize

# Start the collector
Write-Host "Starting collector"
& C:\Windows\System32\logman.exe start -n $collectorName
