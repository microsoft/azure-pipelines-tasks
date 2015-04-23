[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)]
    $websiteUrl,
    [String] [Parameter(Mandatory = $true)]
    $testName,
    [String] [Parameter(Mandatory = $true)]
    $vuLoad,
    [String] [Parameter(Mandatory = $true)]
    $runDuration,
    [String] [Parameter(Mandatory = $true)]
    $geoLocation,

    [String] [Parameter(Mandatory = $true)]
    $CltAccountUrl,
    [String] [Parameter(Mandatory = $true)]
    $Username,
    [String] [Parameter(Mandatory = $true)]
    $Password
)

$userAgent = "QuickPerfTestBuildTask"

function InitializeRestHeaders()
{
    $restHeaders = New-Object -TypeName "System.Collections.Generic.Dictionary[[String], [String]]"

    $alternateCreds = [String]::Concat($Username, ":", $Password)
    $basicAuth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($alternateCreds))
    $restHeaders.Add("Authorization", [String]::Concat("Basic ", $basicAuth))
    $restHeaders.Add("Content-Type", "application/json")

    return $restHeaders
}

function ComposeTestDropJson($name, $duration, $homepage, $vu)
{
$tdjson = @"
{
    "dropType": "InplaceDrop",
	"loadTestDefinition":{
		"loadTestName":"$name",
		"runDuration":$duration,
		"urls":["$homepage"],
		"browserMixs":[
			{"browserName":"Internet Explorer 11.0","browserPercentage":60.0},
			{"browserName":"Chrome 2","browserPercentage":40.0}
		],
		"loadPatternName":"Constant",
		"maxVusers":$vu,
		"loadGenerationGeoLocations":[]
	}
}
"@

    return $tdjson
}

function CreateTestDrop($headers, $dropJson)
{
    $uri = [String]::Format("{0}/_apis/clt/testdrops?api-version=1.0", $CltAccountUrl)
    $drop = Invoke-RestMethod -UserAgent $userAgent -Uri $uri -Method Post -Headers $headers -Body $dropJson

    return $drop
}

function GetTestDrop($headers, $drop)
{
    $uri = [String]::Format("{0}/_apis/clt/testdrops/{1}?api-version=1.0", $CltAccountUrl, $drop.id)
    $testdrop = Invoke-RestMethod -UserAgent $userAgent -Uri $uri -Headers $headers

    return $testdrop
}

function UploadTestDrop($testdrop)
{
    $uri = New-Object System.Uri($testdrop.accessData.dropContainerUrl)
    $sas = New-Object Microsoft.WindowsAzure.Storage.Auth.StorageCredentials($testdrop.accessData.sasKey)
    $container = New-Object Microsoft.WindowsAzure.Storage.Blob.CloudBlobContainer($uri, $sas)

    return $container
}

function GetTestRuns($headers)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns?api-version=1.0", $CltAccountUrl)
    $runs = Invoke-RestMethod -UserAgent $userAgent -Uri $uri -Headers $headers

    return $runs
}

function RunInProgress($run)
{
    return $run.state -eq "queued" -or $run.state -eq "inProgress"
}

function MonitorTestRun($headers, $run)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?api-version=1.0", $CltAccountUrl, $run.id)

    do
    {
        Start-Sleep -s 5
        Write-Output "Invoke-RestMethod -Uri $uri"
        $run = Invoke-RestMethod -UserAgent $userAgent -Uri $uri -Headers $headers
        Write-Output $run.state
    }
    while (RunInProgress $run)
}

function ComposeTestRunJson($name, $tdid)
{
$trjson = @"
{
    "name":"$name",
    "description":"Quick perf test from automation task",
    "testSettings":{"cleanupCommand":"", "hostProcessPlatform":"x86", "setupCommand":""},
    "testDrop":{"id":"$tdid"},
}
"@

    return $trjson
}

function QueueTestRun($headers, $runJson)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns?api-version=1.0", $CltAccountUrl)
    $run = Invoke-RestMethod -UserAgent $userAgent -Uri $uri -Method Post -Headers $headers -Body $runJson

$start = @"
{
  "state": "queued"
}
"@

    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?api-version=1.0", $CltAccountUrl, $run.id)
    Invoke-RestMethod -UserAgent $userAgent -Uri $uri -Method Patch -Headers $headers -Body $start
    $run = Invoke-RestMethod -UserAgent $userAgent -Uri $uri -Headers $headers

    return $run
}

Write-Output "Starting Quick Perf Test Script"

$testName = $testName + ".loadtest"
Write-Output "Test Name = $testName"
Write-Output "Run Duration = $runDuration"
Write-Output "Website Url = $websiteUrl"
Write-Output "VU Load = $vuLoad"

$h = InitializeRestHeaders

$dropjson = ComposeTestDropJson $testName $runDuration $websiteUrl $vuLoad
Write-Output "------------------------------"
Write-Output $dropjson
Write-Output "------------------------------"

$drop = CreateTestDrop $h $dropjson

$runJson = ComposeTestRunJson $testName $drop.id
Write-Output "------------------------------"
Write-Output $runJson
Write-Output "------------------------------"

$run = QueueTestRun $h $runJson
Write-Output $run

MonitorTestRun $h $run
Write-Output $run

Write-Output ("Run-id for this load test is {0} and its name is '{1}'. To view detailed results navigate to Load Test | Load Test Manager in Visual Studio IDE, and open this run." -f  $run.runNumber, $run.name )

Write-Output "Finished Quick Perf Test Script"

