[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
    $TestDrop,

    [String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
    $LoadTest,

    [String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
    $TestSettings,

    [String]
    $ThresholdLimit,

    [String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
    $VsoAccountUrl,

    [String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
    $Username,

    [String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
    $Password
)

$global:ThresholdExceeded = $false
$global:RestTimeout = 5
$global:MonitorThresholds = $false
$global:ElsAccountUrl = $VsoAccountUrl

function InitializeRestHeaders()
{
    $restHeaders = New-Object -TypeName "System.Collections.Generic.Dictionary[[String], [String]]"

    $alternateCreds = [String]::Concat($Username, ":", $Password)
    $basicAuth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($alternateCreds))
    $restHeaders.Add("Authorization", [String]::Concat("Basic ", $basicAuth))
    $restHeaders.Add("Content-Type", "application/json")
    $restHeaders.Add("User-Agent", "BuildVnext")
    return $restHeaders
}

function CreateTestDrop($headers)
{
    $uri = [String]::Format("{0}/_apis/clt/testdrops?api-version=1.0", $global:ElsAccountUrl)
    $drop = Invoke-RestMethod  -Uri $uri -Headers $headers -Method Post -Body "{ ""dropType"": ""TestServiceBlobDrop"" }"
    return $drop
}

function Get($headers, $uri)
{
    try
    {
        $result = Invoke-RestMethod -TimeoutSec $global:RestTimeout -Uri $uri -Headers $headers
        return $result
    }
    catch
    {
        Write-Host -NoNewline $_.Exception.Message
    }
}


function GetTestDrop($drop, $headers)
{
    $uri = [String]::Format("{0}/_apis/clt/testdrops/{1}?api-version=1.0", $global:ElsAccountUrl, $drop.id)
    $testdrop = Get $headers $uri
    return $testdrop
}

function GetTestRun($headers, $runId)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?api-version=1.0", $global:ElsAccountUrl, $runId)
    $run = Get $headers $uri
    return $run
}

function GetTestErrors($headers, $run)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}/Errors?detailed=true&api-version=1.0", $global:ElsAccountUrl, $run.id)
    $testerrors = Get $headers $uri
    return $testerrors
}

function QueueTestRun($headers, $runJson)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns?api-version=1.0", $global:ElsAccountUrl)
    $run = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $runJson

$start = @"
    {
      "state": "queued"
    }
"@

    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?api-version=1.0", $global:ElsAccountUrl, $run.id)
    Invoke-RestMethod -Uri $uri -Method Patch -Headers $headers -Body $start
    $run = Invoke-RestMethod -Uri $uri -Headers $headers

    return $run
}

function StopTestRun($headers, $run)
{
$stop = @"
    {
      "state": "aborted"
    }
"@
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?api-version=1.0", $global:ElsAccountUrl, $run.id)
    Invoke-RestMethod -Uri $uri -Method Patch -Headers $headers -Body $stop
    $run = Invoke-RestMethod -Uri $uri -Headers $headers
    return $run

}

function RunInProgress($run)
{
    return $run.state -ne "completed" -and $run.state -ne "error" -and $run.state -ne "aborted"
}

function PrintErrorSummary($headers, $run)
{
    $errors = GetTestErrors $headers $run
    if ($errors -and $errors.count -gt 0 -and  $errors.types.count -gt 0)
    {
        foreach ($type in $errors.types)
        {
            foreach ($subType in $type.subTypes)
            {
                foreach ($errorDetail in $subType.errorDetailList)
                {
                    if ($type.typeName -eq "ThresholdMessage")
                    {
                        Write-Warning ( "[{0}] {1} occurrences of {2} " -f $type.typeName, $errorDetail.occurrences, $errorDetail.messageText)
                    }
                    else
                    {
                        Write-Warning ( "[{0}] {1} occurrences of ['{2}','{3}','{4}'] : {5} " -f $type.typeName, $errorDetail.occurrences, $errorDetail.scenarioName, $errorDetail.testCaseName,
                        $subType.subTypeName, $errorDetail.messageText)
                    }
                }
                if ($type.typeName -eq "ThresholdMessage" -and $subType.subTypeName -eq "Critical" -and $global:MonitorThresholds -and $subType.occurrences -gt $ThresholdLimit)
                {
                    Write-Error ( "Your loadtest has crossed the permissible {0} threshold violations with {1} violations" -f $ThresholdLimit, $subType.occurrences )
                }
            }
        }
    }
}

function CheckTestErrors($headers, $run)
{
    if ($global:MonitorThresholds)
    {
        $uri = [String]::Format("{0}/_apis/clt/testruns/{1}/Errors?type=ThresholdMessage&detailed=True&api-version=1.0", $global:ElsAccountUrl, $run.id)
        $errors = Invoke-RestMethod -Uri $uri -Headers $headers

        if ($errors -and $errors.count -gt 0 -and  $errors.types.count -gt 0)
        {
            foreach ($subType in $errors.types.subTypes)
            {
                if ($subType.subTypeName -eq 'Critical' -and $subType.occurrences -gt $ThresholdLimit)
                {
                    $global:ThresholdExceeded=$true
                    return $true;
                }
            }
        }
    }
    return $false;
}

function ShowMessages($headers, $run)
{
     $uri = [String]::Format("{0}/_apis/clt/testruns/{1}/Messages?api-version=1.0", $global:ElsAccountUrl, $run.id)
     $messages = Invoke-RestMethod -Uri $uri -Headers $headers
     if ($messages)
     {
        $sMessages = $messages.value | Sort-Object loggedDate
        foreach ($message in $sMessages)
        {
            switch ($message.messageType)
            {
                "info" { Write-Host -NoNewline ("[Message] {0}" -f $message.message )}
                "output" { Write-Host -NoNewline ("[Message] {0}" -f $message.message )}
                "warning" { Write-Warning $message.message }
                "error" {Write-Error $message.message}
                "critical" {Write-Error $message.message}
            }
        }
     }
 }

function UploadFile($container, $file)
{
    try
    {
        $blob = $container.GetBlockBlobReference($file.Name)
        $stream = [System.IO.File]::OpenRead($file.FullName);
        $blob.UploadFromStream($stream)
    }finally
    {
        $stream.Close();
    }
}

function UploadTestDrop($testdrop, $dir)
{
    $uri = New-Object System.Uri($testdrop.accessData.dropContainerUrl)
    $sas = New-Object Microsoft.WindowsAzure.StorageCredentialsSharedAccessSignature($testdrop.accessData.sasKey)
    $container = New-Object Microsoft.WindowsAzure.StorageClient.CloudBlobContainer($uri, $sas)

    foreach ($file in Get-ChildItem -Path $dir -recurse | where {!($_.psiscontainer)})
    {
        UploadFile $container $file
    }
}

function ComposeTestRunJson($name, $tdid)
{
    $processPlatform = "x86"
    $setupScript=""
    $cleanupScript=""

    $testSettingsFile = Get-ChildItem -Path $TestDrop -recurse | where {$_.Name -eq $TestSettings}
    if ($testSettingsFile) #If testsettingsfile exists
    {
        $fullName = $testSettingsFile.FullName
        [xml]$testSettings = Get-Content $fullName
        if ($testSettings.TestSettings.Scripts.setupScript)
        {
            $setupScript = [System.IO.Path]::GetFileName($testSettings.TestSettings.Scripts.setupScript)
        }
        if ($testSettings.TestSettings.Scripts.cleanupScript)
        {
            $cleanupScript = [System.IO.Path]::GetFileName($testSettings.TestSettings.Scripts.cleanupScript)
        }
        if ($testSettings.TestSettings.Execution.hostProcessPlatform)
        {
            $processPlatform = $testSettings.TestSettings.Execution.hostProcessPlatform
        }
    }
        $trjson = @"
    {
        "name":"$name",
        "description":"Load Test queued from build",
        "testSettings":{"cleanupCommand":"$cleanupScript", "hostProcessPlatform":"$processPlatform", "setupCommand":"$setupScript"},
        "testDrop":{"id":"$tdid"},
    }
"@
    return $trjson
}

function WriteTaskMessages($message)
{
    Write-Host ("{0} " -f $message ) -NoNewline
}

function MonitorTestRun($headers, $run)
{
    $runId = $run.id
    if ($runId)
    {
        $abortRun = $false
        do
        {
            Start-Sleep -s 15
            $run = GetTestRun $headers $runId
            $abortRun = CheckTestErrors $headers $run
            if ($abortRun)
            {
                StopTestRun $headers $run
            }
        }
        while (RunInProgress $run)
    }
}

function MonitorAcquireResource($headers, $run)
{
    $runId = $run.id
    if ($runId)
    {
        $elapsed = [System.Diagnostics.Stopwatch]::StartNew()
        do
        {
            Start-Sleep -s 5
            $run = GetTestRun $headers $runId
        }
        while ($run.state -eq "queued")
        if ($run.state -eq "inProgress")
        {
            WriteTaskMessages ("Acquiring test resources took {0}. Starting test execution." -f $($elapsed.Elapsed.ToString()))
        }
    }
}

function SetAccountUrl()
{
    $accountName = $VsoAccountUrl.Split('//')[2].Split('.')[0]
    $elsUrl = ("https://{0}.vsclt.visualstudio.com" -f $accountName)
    $global:ElsAccountUrl = $elsUrl
}

function ErrorMessage($message)
{
    Write-Error $message
    exit $LastExitCode
}


function ValidateFiles($inputName, $fileName)
{
    $file = Get-ChildItem -Path $TestDrop -recurse | where {$_.Name -eq $fileName}
    if ($file)
    {
        #Check for fileName
        Write-Host -NoNewline ("{0} = {1}"  -f $inputName, $file.FullName)
    }
    else
    {
        ErrorMessage "No $inputName is present in the test drop."
    }
}

function Validate()
{
    if (-Not (Test-Path $TestDrop))
    {
        ErrorMessage "The path for the load test files does not exist. Please provide a valid path."
    }

    ValidateFiles "Load test File" $LoadTest
    ValidateFiles "Test settings File" $TestSettings

    if ($PSVersionTable.PSVersion.Major -lt 3)
    {
        ErrorMessage "Major version of powershell installed on agent needs to be 3 or more."
    }

    try
    {
        Add-Type -Path 'C:\Program Files\Microsoft SDKs\Azure\.NET SDK\*\bin\Microsoft.WindowsAzure.StorageClient.dll'
    }
    catch
    {
        $_.LoaderExceptions | %
        {
            ErrorMessage "For cloud load test to work, the build agent needs Azure SDK."
        }
    }
}

############################################## PS Script execution starts here ##########################################
WriteTaskMessages "Starting Load Test Script"

#Validate Input
Validate

#Setting Headers and account Url accordingly
$headers = InitializeRestHeaders
SetAccountUrl

#Setting monitoring of Threshold rule appropriately
if ($ThresholdLimit -and $ThresholdLimit -ge 0)
{
    $global:MonitorThresholds = $true
}

#Upload the test drop
$elapsed = [System.Diagnostics.Stopwatch]::StartNew()
$drop = CreateTestDrop $headers
$drop = GetTestDrop $drop $headers
UploadTestDrop $drop $TestDrop
WriteTaskMessages ( "Uploading test files took {0}. Queuing the test run." -f $($elapsed.Elapsed.ToString()))

#Queue the test run
$runJson = ComposeTestRunJson $LoadTest $drop.id
$run = QueueTestRun $headers $runJson
MonitorAcquireResource $headers $run

#Monitor the test run
$elapsed = [System.Diagnostics.Stopwatch]::StartNew()
MonitorTestRun $headers $run
WriteTaskMessages ( "Run execution took {0}. Collecting results." -f $($elapsed.Elapsed.ToString()))

#Print the error and messages
$run = GetTestRun $headers $run.id
ShowMessages $headers $run
PrintErrorSummary $headers $run

if ($global:ThresholdExceeded -eq $true -or $run.state -ne "completed" )
{
    Write-Error "The Cloud Load Test has failed."

}
else
{
    WriteTaskMessages "The load test completed successfully."
}

WriteTaskMessages ("Run Id for this load test is {0} and the load test name is '{1}'. To view detailed results go to the load test manager in Visual Studio Ulitmate IDE." -f  $run.runNumber, $run.name )
WriteTaskMessages "Finished Load Test Script"

