[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)]
    $connectedServiceName,

    [String] [Parameter(Mandatory = $true)]
    $websiteUrl,
    [String] [Parameter(Mandatory = $true)]
    $testName,
    [String] [Parameter(Mandatory = $true)]
    $vuLoad,
    [String] [Parameter(Mandatory = $true)]
    $runDuration,
    [String] [Parameter(Mandatory = $true)]
    $geoLocation
)

$userAgent = "QuickPerfTestBuildTask"

function InitializeRestHeaders()
{
    $restHeaders = New-Object -TypeName "System.Collections.Generic.Dictionary[[String], [String]]"

    $alternateCreds = [String]::Concat($Username, ":", $Password)
    $basicAuth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($alternateCreds))
    $restHeaders.Add("Authorization", [String]::Concat("Basic ", $basicAuth))

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
        "loadGenerationGeoLocations":[
            {"Location":"$geoLocation","Percentage":100}
        ]
    }
}
"@

    return $tdjson
}

function CreateTestDrop($headers, $dropJson)
{
    $uri = [String]::Format("{0}/_apis/clt/testdrops?api-version=1.0", $CltAccountUrl)
    $drop = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Method Post -Headers $headers -Body $dropJson

    return $drop
}

function GetTestDrop($headers, $drop)
{
    $uri = [String]::Format("{0}/_apis/clt/testdrops/{1}?api-version=1.0", $CltAccountUrl, $drop.id)
    $testdrop = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Headers $headers

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
    $runs = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Headers $headers

    return $runs
}

function RunInProgress($run)
{
    return $run.state -eq "queued" -or $run.state -eq "inProgress"
}

function MonitorTestRun($headers, $run)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?api-version=1.0", $CltAccountUrl, $run.id)
    $prevState = $run.state
    $prevSubState = $run.subState
    Write-Output ("Load test '{0}' is in state '{1}|{2}'." -f  $run.name, $run.state, $run.subState)

    do
    {
        Start-Sleep -s 5
        $run = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Headers $headers
        if ($prevState -ne $run.state -or $prevSubState -ne $run.subState)
        {
            $prevState = $run.state
            $prevSubState = $run.subState
            Write-Output ("Load test '{0}' is in state '{1}|{2}'." -f  $run.name, $run.state, $run.subState)
        }
    }
    while (RunInProgress $run)

    $run = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Headers $headers
    Write-Output "------------------------------------"
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}/messages?api-version=1.0", $CltAccountUrl, $run.id)
    $messages = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Headers $headers

    if ($messages)
    {
        $timeSorted = $messages.value | Sort-Object loggedDate
        foreach ($message in $timeSorted)
        {
            switch ($message.messageType)
            {
                "info"      { Write-Host -NoNewline ("[Message]{0}" -f $message.message) }
                "output"    { Write-Host -NoNewline ("[Output]{0}" -f $message.message) }
                "warning"   { Write-Warning $message.message }
                "error"     { Write-Error $message.message }
                "critical"  { Write-Error $message.message }
            }
        }
    }

    Write-Output "------------------------------------"
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
    $run = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Method Post -Headers $headers -Body $runJson

$start = @"
{
  "state": "queued"
}
"@

    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?api-version=1.0", $CltAccountUrl, $run.id)
    Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Method Patch -Headers $headers -Body $start
    $run = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Headers $headers

    return $run
}

function ComposeAccountUrl($vsoUrl)
{
    $elsUrl = $vsoUrl

    if ($vsoUrl -notlike "*VSCLT.VISUALSTUDIO.COM*")
    {
        if ($vsoUrl -like "*VISUALSTUDIO.COM*")
        {
            $accountName = $vsoUrl.Split('//')[2].Split('.')[0]
            $elsUrl = ("https://{0}.vsclt.visualstudio.com" -f $accountName)
        }
    }

    return $elsUrl
}

function ValidateInputs()
{
    if (![System.Uri]::IsWellFormedUriString($websiteUrl, [System.UriKind]::Absolute))
    {
        throw "Website Url is not well formed."
    }
}

############################################## PS Script execution starts here ##########################################
Write-Output "Starting Quick Perf Test Script"

$testName = $testName + ".loadtest"
Write-Output "Test name = $testName"
Write-Output "Run duration = $runDuration"
Write-Output "Website Url = $websiteUrl"
Write-Output "Virtual user load = $vuLoad"
Write-Output "Load location = $geoLocation"

$serviceEndpoint = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName

$Username = $serviceEndpoint.Authorization.Parameters.Username
$Password = $serviceEndpoint.Authorization.Parameters.Password
$VSOAccountUrl = $serviceEndpoint.Url.AbsoluteUri
##$EndpointName = $serviceEndpoint.Name
$CltAccountUrl = ComposeAccountUrl($VSOAccountUrl)

Write-Verbose "VSO account Url = $VSOAccountUrl" -Verbose

ValidateInputs

$h = InitializeRestHeaders

$dropjson = ComposeTestDropJson $testName $runDuration $websiteUrl $vuLoad
$drop = CreateTestDrop $h $dropjson
if ($drop.dropType -eq "InPlaceDrop")
{
    $runJson = ComposeTestRunJson $testName $drop.id

    $run = QueueTestRun $h $runJson
    MonitorTestRun $h $run

    Write-Output ("Run-id for this load test is {0} and its name is '{1}'." -f  $run.runNumber, $run.name)
    Write-Output "To view detailed results navigate to Load Test | Load Test Manager in Visual Studio IDE, and open this run."
}
else
{
    Write-Error ("Failed to connect to the endpoint '{0}' for VSO account '{1}'" -f $EndpointName, $VSOAccountUrl)
}

Write-Output "Finished Quick Perf Test Script"

