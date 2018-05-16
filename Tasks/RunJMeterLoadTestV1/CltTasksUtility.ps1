function InvokeRestMethod($headers, $contentType, $uri , $method= "Get", $body)
{
    $restTimeout = 60
    $ServicePoint = [System.Net.ServicePointManager]::FindServicePoint($uri)
    $result = Invoke-RestMethod -ContentType "application/json" -UserAgent $global:userAgent -TimeoutSec $restTimeout -Uri $uri -Method $method -Headers $headers -Body $body
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

function CreateTestDrop($headers, $CltAccountUrl)
{
    $uri = [String]::Format("{0}/_apis/clt/testdrops?{1}", $CltAccountUrl, $global:apiVersion)
    $drop = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers -method Post -body "{ ""dropType"": ""TestServiceBlobDrop"" }"
    return $drop
}

function GetTestDrop($headers, $drop, $CltAccountUrl)
{
    $uri = [String]::Format("{0}/_apis/clt/testdrops/{1}?{2}", $CltAccountUrl, $drop.id, $global:apiVersion)
    $testdrop = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers

    return $testdrop
}

function UploadTestDrop($testdrop, $src)
{   
    $dest = $testdrop.accessData.dropContainerUrl
    $sas = $testdrop.accessData.sasKey

    $azcopy = Get-ToolPath -Name "AzCopy\AzCopy.exe"
    Write-Verbose "Calling AzCopy = $azcopy" -Verbose

    $azlog = ("{0}\..\azlog" -f $src)
    $args = ("/Source:`"{0}`" /Dest:{1} /DestSAS:{2} /S /Z:`"{3}`"" -f $src, $dest, $sas, $azlog)

    # Create a file with the arguments as the content
    $responseFile = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($responseFile, $args)

    $responseFileArgs = [String]::Format("/@:""{0}""", $responseFile)
    try {
        Write-Verbose "Calling AzCopy tool with file $responseFile" -Verbose 
        Invoke-Tool -Path $azcopy -Arguments $responseFileArgs
    }
    finally {
        [System.IO.File]::Delete($responseFile)
        Write-Verbose "Azcopy completed.. Deleted file $responseFile" -Verbose 
    }
}


function GetTestRun($headers, $runId, $CltAccountUrl)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?{2}", $CltAccountUrl, $runId, $global:apiVersion)
    $run = Get $headers $uri
    return $run
}

function GetTestRunUri($testRunId, $headers, $CltAccountUrl)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?{2}", $CltAccountUrl, $testRunId, $global:apiVersion)
    $run = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers

    return $run.WebResultUrl
}

function RunInProgress($run)
{
    return $run.state -eq "queued" -or $run.state -eq "inProgress"
}

function MonitorTestRun($headers, $run, $CltAccountUrl, $monitorThresholds)
{
    $runId = $run.id
    if ($runId)
    {
        $abortRun = $false
        do
        {
            Start-Sleep -s 15
            $run = GetTestRun $headers $runId $CltAccountUrl
            $abortRun = CheckTestErrors $headers $run $CltAccountUrl $monitorThresholds
            if ($abortRun)
            {
                StopTestRun $headers $run $CltAccountUrl
            }
        }
        while (RunInProgress $run)
    }
    return $abortRun
}

function QueueTestRun($headers, $runJson, $CltAccountUrl)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns?{1}", $CltAccountUrl, $global:apiVersion)
    $run = InvokeRestMethod -contentType "application/json" -uri $uri -method Post -headers $headers -body $runJson

    $start = @"
    {
    "state": "queued"
    }
"@

    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?{2}", $CltAccountUrl, $run.id, $global:apiVersion)
    InvokeRestMethod -contentType "application/json" -uri $uri -method Patch -headers $headers -body $start
    $run = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers

    return $run
}

function ComposeAccountUrl($connectedServiceUrl, $headers)
{
    #Load all dependent files for execution
    . $PSScriptRoot/VssConnectionHelper.ps1
    $connectedServiceUrl = $connectedServiceUrl.TrimEnd('/')
    Write-Host "Getting Clt Endpoint:"
    $elsUrl = Get-CltEndpoint $connectedServiceUrl $headers

    return $elsUrl
}

function UploadSummaryMdReport($summaryMdPath)
{
    Write-Verbose "Summary Markdown Path = $summaryMdPath"

    if ((Test-Path($summaryMdPath)))
    {   
        Write-Host "##vso[task.addattachment type=Distributedtask.Core.Summary;name=Load test results;]$summaryMdPath"
    }
}

function isNumericValue ($str) {
    $numericValue = 0
    $isNum = [System.Int32]::TryParse($str, [ref]$numericValue)
    return $isNum
}

function ValidateFiles($inputName, $fileName)
{
    $file = Get-ChildItem -Path $TestDrop -recurse | where {$_.Name -eq $fileName} | Select -First 1
    if ($file)
    {
        # Check for fileName
        $global:ScopedTestDrop = $file.Directory.FullName
        Write-Host -NoNewline ("Selected {0} is '{1}' under '{2}'"  -f $inputName, $file.FullName, $global:ScopedTestDrop)
    }
    else
    {
        ErrorMessage "No $inputName is present in the test drop."
    }
}

function ValidateInputs($tfsCollectionUrl, $connectedServiceName, $testDrop, $loadtest)
{
    if (-Not (Test-Path $testDrop))
    {
        ErrorMessage "The path for the load test files does not exist. Please provide a valid path."
    }

    # validate load test name
    # code taken from definitionNameInvalid    
    $invalidPattern1 = "(^\\.$|^\\.\\.$|^-$|^_$)"
    $invalidPattern2 = "[^A-Za-z0-9 \._-]"

    # find illegal characters
    $invalidchars1 = [regex]::Matches($loadtest, $invalidPattern1, 'IgnoreCase').Value | Sort-Object -Unique 
    $invalidchars2 =[regex]::Matches($loadtest, $invalidPattern2, 'IgnoreCase').Value | Sort-Object -Unique 
    
    if ($invalidchars1 -ne $null -or $invalidchars2 -ne $null)
    {
        throw "Do not use these characters in load test name: $invalidchars1 $invalidchars2"
    }

    ValidateFiles "load test file" $loadTest
}

function Get($headers, $uri)
{
    try
    {
        $result = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers
        return $result
    }
    catch
    {
        Write-Host -NoNewline $_.Exception.Message
    }
}

function WriteTaskMessages($message)
{
    Write-Host ("{0}" -f $message ) -NoNewline
}

function MonitorAcquireResource($headers, $run, $CltAccountUrl)
{
    $runId = $run.id
    if ($runId)
    {
        $elapsed = [System.Diagnostics.Stopwatch]::StartNew()
        do
        {
            Start-Sleep -s 5
            $run = GetTestRun $headers $runId $CltAccountUrl
        }
        while ($run.state -eq "queued")
        if ($run.state -eq "inProgress")
        {
            WriteTaskMessages ("Acquiring test resources took {0}. Starting test execution." -f $($elapsed.Elapsed.ToString()))
        }
    }
}

function ErrorMessage($message)
{
    Write-Error $message
    exit $LastExitCode
}

function StopTestRun($headers, $run, $CltAccountUrl)
{
    $stop = @"
    {
    "state": "aborted"
    }
"@
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?{2}", $CltAccountUrl, $run.id, $global:apiVersion)
    InvokeRestMethod -contentType "application/json" -uri $uri -method Patch -headers $headers -body $stop
    $run = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers
    return $run

}

function ComposeTestRunJson($name, $tdid, $agentCount, $runDuration, $machineType)
{
    $processPlatform = "x86"
    $setupScript=""
    $cleanupScript=""

    $trjson = @"
    {
        "name":"$name",
        "runType":"jMeterLoadTest",
        "description":"Apache Jmeter test queued from build",
        "testSettings":{"cleanupCommand":"$cleanupScript", "hostProcessPlatform":"$processPlatform", "setupCommand":"$setupScript"},
        "runSpecificDetails":{"coreCount":"$agentCount", "duration":"$runDuration", "samplingInterval":15},
        "superSedeRunSettings":{"loadGeneratorMachinesType":"$machineType"},
        "testDrop":{"id":"$tdid"},
        "runSourceIdentifier":"build/$env:SYSTEM_DEFINITIONID/$env:BUILD_BUILDID"
    }
"@
    return $trjson
}

function ShowMessages($headers, $run, $CltAccountUrl)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}/messages?{2}", $CltAccountUrl, $run.id, $global:apiVersion)
    $messages = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers
    if ($messages)
    {
        $sMessages = $messages.value | Sort-Object loggedDate
        foreach ($message in $sMessages)
        {
            switch ($message.messageType)
            {
                "info"     { Write-Host -NoNewline ("[Message]{0}" -f $message.message) }
                "output"   { Write-Host -NoNewline ("[Message]{0}" -f $message.message) }
                "warning"  { Write-Warning $message.message }
                "error"    { Write-Error $message.message }
                "critical" { Write-Error $message.message }
            }
        }
    }
}

function GetTestErrors($headers, $run, $CltAccountUrl)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}/errors?detailed=true&{2}", $CltAccountUrl, $run.id, $global:apiVersion)
    $testerrors = Get $headers $uri
    return $testerrors
}

function PrintErrorSummary($headers, $run, $CltAccountUrl, $monitorThresholds)
{
    $thresholdViolationsCount = 0
    $errors = GetTestErrors $headers $run $CltAccountUrl
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
                        $thresholdViolationsCount += $errorDetail.occurrences
                    }
                    else
                    {
                        Write-Warning ( "[{0}] {1} occurrences of ['{2}','{3}','{4}'] : {5} " -f $type.typeName, $errorDetail.occurrences, $errorDetail.scenarioName, $errorDetail.testCaseName,
                        $subType.subTypeName, $errorDetail.messageText)
                    }
                }
                if ($type.typeName -eq "ThresholdMessage" -and $subType.subTypeName -eq "Critical" -and $monitorThresholds -and $subType.occurrences -gt $ThresholdLimit)
                {
                    Write-Error ( "Your loadtest has crossed the permissible {0} threshold violations with {1} violations" -f $ThresholdLimit, $subType.occurrences )
                }
            }
        }       
    }
    return $thresholdViolationsCount
}


function CheckTestErrors($headers, $run, $CltAccountUrl, $MonitorThresholds)
{
    $thresholdExceeded = $false
    if ($MonitorThresholds)
    {
        $uri = [String]::Format("{0}/_apis/clt/testruns/{1}/errors?type=ThresholdMessage&detailed=True&{2}", $CltAccountUrl, $run.id, $global:apiVersion)
        $errors = InvokeRestMethod -contentType "application/json" -uri $uri -headers $headers

        if ($errors -and $errors.count -gt 0 -and  $errors.types.count -gt 0)
        {
            foreach ($subType in $errors.types.subTypes)
            {
                if ($subType.subTypeName -eq 'Critical' -and $subType.occurrences -gt $ThresholdLimit)
                {
                    $thresholdExceeded = $true
                    return $true;
                }
            }
        }
    }
    return $false;
}

