function InvokeRestMethod($headers, $contentType, $uri , $method= "Get", $body)
{
	$ServicePoint = [System.Net.ServicePointManager]::FindServicePoint($uri)
	$result = Invoke-RestMethod -ContentType "application/json" -UserAgent $global:userAgent -TimeoutSec $global:RestTimeout -Uri $uri -Method $method -Headers $headers -Body $body
	$ServicePoint.CloseConnectionGroup("")
	return $result
}

function ComposeTestDropJson($name, $duration, $homepage, $vu, $geoLocation)
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

function CreateTestDrop($headers, $dropJson, $CltAccountUrl)
{
	$uri = [String]::Format("{0}/_apis/clt/testdrops?api-version=1.0", $CltAccountUrl)
	$drop = InvokeRestMethod -contentType "application/json" -uri $uri -method Post -headers $headers -body $dropJson

	return $drop
}

function GetTestDrop($headers, $drop, $CltAccountUrl)
{
	$uri = [String]::Format("{0}/_apis/clt/testdrops/{1}?api-version=1.0", $CltAccountUrl, $drop.id)
	$testdrop = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers

	return $testdrop
}

function UploadTestDrop($testdrop)
{
	$uri = New-Object System.Uri($testdrop.accessData.dropContainerUrl)
	$sas = New-Object Microsoft.WindowsAzure.Storage.Auth.StorageCredentials($testdrop.accessData.sasKey)
	$container = New-Object Microsoft.WindowsAzure.Storage.Blob.CloudBlobContainer($uri, $sas)

	return $container
}

#function GetTestRuns($headers, $CltAccountUrl)
#{
#    $uri = [String]::Format("{0}/_apis/clt/testruns?api-version=1.0", $CltAccountUrl)
#    $runs = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers

#    return $runs
#}

function GetTestRunUri($testRunId, $headers, $CltAccountUrl)
{
	$uri = [String]::Format("{0}/_apis/clt/testruns/{1}?api-version=1.0", $CltAccountUrl,$testRunId)
	$run = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers

	return $run.WebResultUrl
}

function RunInProgress($run)
{
	return $run.state -eq "queued" -or $run.state -eq "inProgress"
}

function MonitorTestRun($headers, $run, $CltAccountUrl)
{
	$uri = [String]::Format("{0}/_apis/clt/testruns/{1}?api-version=1.0", $CltAccountUrl, $run.id)
	$prevState = $run.state
	$prevSubState = $run.subState
	Write-Output ("Load test '{0}' is in state '{1}|{2}'." -f  $run.name, $run.state, $run.subState)

	do
	{
		Start-Sleep -s 15
		$run = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers
		if ($prevState -ne $run.state -or $prevSubState -ne $run.subState)
		{
			$prevState = $run.state
			$prevSubState = $run.subState
			Write-Output ("Load test '{0}' is in state '{1}|{2}'." -f  $run.name, $run.state, $run.subState)
		}
	}
	while (RunInProgress $run)

	$run = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers
	Write-Output "------------------------------------"
	$uri = [String]::Format("{0}/_apis/clt/testruns/{1}/messages?api-version=1.0", $CltAccountUrl, $run.id)
	$messages = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers

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

function QueueTestRun($headers, $runJson, $CltAccountUrl)
{
	$uri = [String]::Format("{0}/_apis/clt/testruns?api-version=1.0", $CltAccountUrl)
	$run = InvokeRestMethod -contentType "application/json" -uri $uri -method Post -headers $headers -body $runJson

	$start = @"
	{
	"state": "queued"
	}
"@

	$uri = [String]::Format("{0}/_apis/clt/testruns/{1}?api-version=1.0", $CltAccountUrl, $run.id)
	InvokeRestMethod -contentType "application/json" -uri $uri -method Patch -headers $headers -body $start
	$run = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers

	return $run
}

function ComposeAccountUrl($connectedServiceUrl, $headers)
{
	#Load all dependent files for execution
	. $PSScriptRoot/VssConnectionHelper.ps1
	$connectedServiceUrl = $connectedServiceUrl.TrimEnd('/')
    Write-Host -NoNewline "Getting Clt Endpoint:"
	$elsUrl = Get-CltEndpoint $connectedServiceUrl $headers

	return $elsUrl
}

function ValidateInputs($websiteUrl, $tfsCollectionUrl, $connectedServiceName, $testName)
{
	if (![System.Uri]::IsWellFormedUriString($websiteUrl, [System.UriKind]::Absolute))
	{
		throw "Website Url is not well formed."
	}
	
	if([string]::IsNullOrWhiteSpace($connectedServiceName) -and $tfsCollectionUrl -notlike "*VISUALSTUDIO.COM*" -and $tfsCollectionUrl -notlike "*TFSALLIN.NET*")
	{
		throw "VS Team Services Connection is mandatory for using performance test tasks on non hosted TFS builds.Please specify a VS Team Services connection and try again "
	}

    # validate load test name
    # code taken from definitionNameInvalid    
    $invalidPattern1 = "(^\\.$|^\\.\\.$|^-$|^_$)"
    $invalidPattern2 = "[^A-Za-z0-9 \._-]"

    # find illegal characters
    $invalidchars1 = [regex]::Matches($testName, $invalidPattern1, 'IgnoreCase').Value | Sort-Object -Unique 
    $invalidchars2 =[regex]::Matches($testName, $invalidPattern2, 'IgnoreCase').Value | Sort-Object -Unique 
    
    if ($invalidchars1 -ne $null -or $invalidchars2 -ne $null)
    {
		throw "Do not use these characters in load test name: $invalidchars1 $invalidchars2"
    }
}

function UploadSummaryMdReport($summaryMdPath)
{
	Write-Verbose "Summary Markdown Path = $summaryMdPath"

	if ((Test-Path($summaryMdPath)))
	{	
		Write-Host "##vso[task.addattachment type=Distributedtask.Core.Summary;name=Load test results;]$summaryMdPath"
	}
}

function IsNumericValue ($str) {
	$numericValue = 0
	$isNum = [System.Int32]::TryParse($str, [ref]$numericValue)
	return $isNum
}


function ComposeTestRunJson($name, $tdid, $vuLoad, $runDuration, $machineType, $selfProvisionedRig, $numOfSelfProvisionedAgents)
{
    if ($MachineType -eq "2"){
        Write-Host ">>> Self-Provisioned Rig Test Run"
        $trjson = @"
        {
            "name":"$name",
            "description":"Quick perf test from automation task",
            "testSettings":{"cleanupCommand":"", "hostProcessPlatform":"x64", "setupCommand":""},
            "superSedeRunSettings": {
                "loadGeneratorMachinesType": "$MachineType",
                "staticAgentRunSettings": {
                    "loadGeneratorMachinesType": "userLoadAgent",
                    "staticAgentGroupName": "$selfProvisionedRig"
                }
            },
            "runSpecificDetails" : {
                "virtualUserCount": $vuLoad,
                "duration": $runDuration,
                "agentCount": $numOfSelfProvisionedAgents,
                "loadGeneratorMachinesType": "userLoadAgent"
            },
            "testDrop":{"id":"$tdid"},
            "runSourceIdentifier":"build/$env:SYSTEM_DEFINITIONID/$env:BUILD_BUILDID"
        }
"@
    } else {
        $trjson = @"
        {
            "name":"$name",
            "description":"Quick perf test from automation task",
            "testSettings":{"cleanupCommand":"", "hostProcessPlatform":"x64", "setupCommand":""},
            "superSedeRunSettings":{"loadGeneratorMachinesType":"$machineType"},
            "testDrop":{"id":"$tdid"},
            "runSourceIdentifier":"build/$env:SYSTEM_DEFINITIONID/$env:BUILD_BUILDID"
        }
"@
    }
	return $trjson
}

