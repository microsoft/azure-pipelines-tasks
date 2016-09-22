[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String]
    $env:SYSTEM_DEFINITIONID,
    [String]
    $env:BUILD_BUILDID,

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
    $geoLocation,
    [String] [Parameter(Mandatory = $true)]
    $machineType
)

$userAgent = "QuickPerfTestBuildTask"

$global:RestTimeout = 60

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
    $testdrop = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -TimeoutSec $global:RestTimeout -Uri $uri -Headers $headers

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
    $runs = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -TimeoutSec $global:RestTimeout -Uri $uri -Headers $headers

    return $runs
}

function GetTestRunUri($testRunId, $headers)
{
 $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?api-version=1.0", $CltAccountUrl,$testRunId)
 $run = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -TimeoutSec $global:RestTimeout -Uri $uri -Headers $headers
 
 return $run.WebResultUrl
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
    "superSedeRunSettings":{"loadGeneratorMachinesType":"$MachineType"},
    "testDrop":{"id":"$tdid"},
    "runSourceIdentifier":"build/$env:SYSTEM_DEFINITIONID/$env:BUILD_BUILDID"
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

function UploadSummaryMdReport($summaryMdPath)
{
	Write-Verbose "Summary Markdown Path = $summaryMdPath"

	if (($env:SYSTEM_HOSTTYPE -eq "build") -and (Test-Path($summaryMdPath)))
	{	
		Write-Host "##vso[task.addattachment type=Distributedtask.Core.Summary;name=Load test results;]$summaryMdPath"
	}
}

############################################## PS Script execution starts here ##########################################
Write-Output "Starting Quick Perf Test Script"

import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

$testName = $testName + ".loadtest"
Write-Output "Test name = $testName"
Write-Output "Run duration = $runDuration"
Write-Output "Website Url = $websiteUrl"
Write-Output "Virtual user load = $vuLoad"
Write-Output "Load location = $geoLocation"
Write-Output "Load generator machine type = $machineType"
Write-Output "Run source identifier = build/$env:SYSTEM_DEFINITIONID/$env:BUILD_BUILDID"

#Validate Input
ValidateInputs

$connectedServiceDetails = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName

$Username = $connectedServiceDetails.Authorization.Parameters.Username
Write-Verbose "Username = $Username" -Verbose
$Password = $connectedServiceDetails.Authorization.Parameters.Password
$VSOAccountUrl = $connectedServiceDetails.Url.AbsoluteUri
$CltAccountUrl = ComposeAccountUrl($VSOAccountUrl).TrimEnd('/')
$TFSAccountUrl = $env:System_TeamFoundationCollectionUri.TrimEnd('/')

Write-Verbose "VSO account Url = $TFSAccountUrl" -Verbose
Write-Verbose "CLT account Url = $CltAccountUrl" -Verbose

$headers = InitializeRestHeaders

$dropjson = ComposeTestDropJson $testName $runDuration $websiteUrl $vuLoad
$drop = CreateTestDrop $headers $dropjson
if ($drop.dropType -eq "InPlaceDrop")
{
    $runJson = ComposeTestRunJson $testName $drop.id

    $run = QueueTestRun $headers $runJson
    MonitorTestRun $headers $run
    $webResultsUrl = GetTestRunUri $run.id $headers
	
    Write-Output ("Run-id for this load test is {0} and its name is '{1}'." -f  $run.runNumber, $run.name)
    Write-Output ("To view run details navigate to {0}" -f $webResultsUrl)
    Write-Output "To view detailed results navigate to Load Test | Load Test Manager in Visual Studio IDE, and open this run."

    $resultsMDFolder = New-Item -ItemType Directory -Force -Path "$env:Temp\LoadTestResultSummary"
	
    $resultFilePattern = ("QuickPerfTestResults_{0}_{1}_*.md" -f $env:AGENT_ID, $env:SYSTEM_DEFINITIONID)
	
    $excludeFilePattern = ("QuickPerfTestResults_{0}_{1}_{2}_*.md" -f $env:AGENT_ID, $env:SYSTEM_DEFINITIONID, $env:BUILD_BUILDID)   
    Remove-Item $resultsMDFolder\$resultFilePattern -Exclude $excludeFilePattern -Force	
    $summaryFile =  ("{0}\QuickPerfTestResults_{1}_{2}_{3}_{4}.md" -f $resultsMDFolder, $env:AGENT_ID, $env:SYSTEM_DEFINITIONID, $env:BUILD_BUILDID, $run.id)	
	
    $summary = ('[Test Run: {0}]({1}) using {2}.<br/>' -f  $run.runNumber, $webResultsUrl ,$run.name)

	('<p>{0}</p>' -f $summary) >>  $summaryFile
    UploadSummaryMdReport $summaryFile
}
else
{
    Write-Error ("Failed to connect to the endpoint '{0}' for VSO account '{1}'" -f $EndpointName, $VSOAccountUrl)
}

	
Write-Output "Finished Quick Perf Test Script"

