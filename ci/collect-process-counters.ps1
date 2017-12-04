# Remove any previously created collector
Write-Host "Deleting collector"
$collectorName = "vsts-tasks-processes"
& C:\Windows\System32\logman.exe delete -n $collectorName

# Create the collector
Write-Host "Creating collector"
$counters = @(
    "\Process(*)\% Processor Time"
    "\Process(*)\Creating Process ID"
    "\Process(*)\Handle Count"
    "\Process(*)\Elapsed Time"
    "\Process(*)\ID Process"
    "\Process(*)\IO Read Bytes/sec"
    "\Process(*)\IO Write Bytes/sec"
    "\Process(*)\Page Faults/sec"
    "\Process(*)\Thread Count"
    "\Process(*)\Working Set"
)
$sampleInterval = '1' # 1 seconds
$maxSize = "1000" # 1,000 mb
$jobName = $env:system_jobDisplayName
& C:\Windows\System32\logman.exe create counter -n $collectorName -c @counters -o "$PSScriptRoot\..\performance-monitors-$jobName" -v nnnnnn -f bin -a -max $maxSize

# Start the collector
Write-Host "Starting collector"
& C:\Windows\System32\logman.exe start -n $collectorName

# Wait 20 seconds
Start-Sleep -Seconds 20

# Stop the collector
Write-Host "Stopping collector"
& C:\Windows\System32\logman.exe stop -n $collectorName
