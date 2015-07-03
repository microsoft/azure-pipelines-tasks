[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)]
    $connectedServiceName,

    [String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
    $TestSettings,
    [String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
    $TestDrop,
    [String] [Parameter(Mandatory = $true)] [ValidateNotNullOrEmpty()]
    $LoadTest,
    [String]
    $ThresholdLimit
)

$userAgent = "CloudLoadTestBuildTask"
$apiVersion = "api-version=1.0"

$global:ThresholdExceeded = $false
$global:RestTimeout = 5
$global:MonitorThresholds = $false
$global:ElsAccountUrl = "http://www.visualstudio.com"
$global:ScopedTestDrop = $TestDrop

function InitializeRestHeaders()
{
    $restHeaders = New-Object -TypeName "System.Collections.Generic.Dictionary[[String], [String]]"

    $alternateCreds = [String]::Concat($Username, ":", $Password)
    $basicAuth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($alternateCreds))
    $restHeaders.Add("Authorization", [String]::Concat("Basic ", $basicAuth))

    return $restHeaders
}

function CreateTestDrop($headers)
{
    $uri = [String]::Format("{0}/_apis/clt/testdrops?{1}", $global:ElsAccountUrl, $apiVersion)
    $drop = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Headers $headers -Method Post -Body "{ ""dropType"": ""TestServiceBlobDrop"" }"
    return $drop
}

function Get($headers, $uri)
{
    try
    {
        $result = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -TimeoutSec $global:RestTimeout -Uri $uri -Headers $headers
        return $result
    }
    catch
    {
        Write-Host -NoNewline $_.Exception.Message
    }
}

function GetTestDrop($drop, $headers)
{
    $uri = [String]::Format("{0}/_apis/clt/testdrops/{1}?{2}", $global:ElsAccountUrl, $drop.id, $apiVersion)
    $testdrop = Get $headers $uri
    return $testdrop
}

function GetTestRun($headers, $runId)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?{2}", $global:ElsAccountUrl, $runId, $apiVersion)
    $run = Get $headers $uri
    return $run
}

function GetTestErrors($headers, $run)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}/errors?detailed=true&{2}", $global:ElsAccountUrl, $run.id, $apiVersion)
    $testerrors = Get $headers $uri
    return $testerrors
}

function QueueTestRun($headers, $runJson)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns?{1}", $global:ElsAccountUrl, $apiVersion)
    $run = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Method Post -Headers $headers -Body $runJson

$start = @"
    {
      "state": "queued"
    }
"@

    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?{2}", $global:ElsAccountUrl, $run.id, $apiVersion)
    Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Method Patch -Headers $headers -Body $start
    $run = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Headers $headers

    return $run
}

function StopTestRun($headers, $run)
{
$stop = @"
    {
      "state": "aborted"
    }
"@
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}?{2}", $global:ElsAccountUrl, $run.id, $apiVersion)
    Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Method Patch -Headers $headers -Body $stop
    $run = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Headers $headers
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
        $uri = [String]::Format("{0}/_apis/clt/testruns/{1}/errors?type=ThresholdMessage&detailed=True&{2}", $global:ElsAccountUrl, $run.id, $apiVersion)
        $errors = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Headers $headers

        if ($errors -and $errors.count -gt 0 -and  $errors.types.count -gt 0)
        {
            foreach ($subType in $errors.types.subTypes)
            {
                if ($subType.subTypeName -eq 'Critical' -and $subType.occurrences -gt $ThresholdLimit)
                {
                    $global:ThresholdExceeded = $true
                    return $true;
                }
            }
        }
    }
    return $false;
}

function ShowMessages($headers, $run)
{
    $uri = [String]::Format("{0}/_apis/clt/testruns/{1}/messages?{2}", $global:ElsAccountUrl, $run.id, $apiVersion)
    $messages = Invoke-RestMethod -ContentType "application/json" -UserAgent $userAgent -Uri $uri -Headers $headers
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

function UploadTestDrop($testdrop, $src)
{
    $dest = $testdrop.accessData.dropContainerUrl
    $sas = $testdrop.accessData.sasKey

    $azcopy = Get-ToolPath -Name "AzCopy\AzCopy.exe"
    Write-Verbose "Calling AzCopy = $azcopy" -Verbose

    $azlog = ("{0}\..\azlog" -f $src)
    $args = ("/Source:`"{0}`" /Dest:{1} /DestSAS:{2} /S /Z:`"{3}`"" -f $src, $dest, $sas, $azlog)
    Write-Verbose "AzCopy Args = $args" -Verbose

    Invoke-Tool -Path $azcopy -Arguments $args
}

function ComposeTestRunJson($name, $tdid)
{
    $processPlatform = "x86"
    $setupScript=""
    $cleanupScript=""

    [xml]$tsxml = Get-Content $TestSettings
    if ($tsxml.TestSettings.Scripts.setupScript)
    {
        $setupScript = [System.IO.Path]::GetFileName($tsxml.TestSettings.Scripts.setupScript)
    }
    if ($tsxml.TestSettings.Scripts.cleanupScript)
    {
        $cleanupScript = [System.IO.Path]::GetFileName($tsxml.TestSettings.Scripts.cleanupScript)
    }
    if ($tsxml.TestSettings.Execution.hostProcessPlatform)
    {
        $processPlatform = $tsxml.TestSettings.Execution.hostProcessPlatform
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
    Write-Host ("{0}" -f $message ) -NoNewline
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

function ErrorMessage($message)
{
    Write-Error $message
    exit $LastExitCode
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

function Validate()
{
    if (-Not (Test-Path $TestSettings))
    {
        ErrorMessage "The path for the test settings file does not exist. Please provide a valid path."
    }

    if (-Not (Test-Path $TestDrop))
    {
        ErrorMessage "The path for the load test files does not exist. Please provide a valid path."
    }

    ValidateFiles "load test file" $LoadTest
}

############################################## PS Script execution starts here ##########################################
WriteTaskMessages "Starting Load Test Script"

Write-Output "Test settings = $TestSettings"
Write-Output "Test drop = $TestDrop"
Write-Output "Load test = $LoadTest"

#Validate Input
Validate

#Setting monitoring of Threshold rule appropriately
if ($ThresholdLimit -and $ThresholdLimit -ge 0)
{
    $global:MonitorThresholds = $true
    Write-Output "Threshold limit = $ThresholdLimit"
}

$connectedServiceDetails = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName

$Username = $connectedServiceDetails.Authorization.Parameters.Username
Write-Verbose "Username = $userName" -Verbose
$Password = $connectedServiceDetails.Authorization.Parameters.Password
$global:ElsAccountUrl = ComposeAccountUrl($connectedServiceDetails.Url.AbsoluteUri)
Write-Verbose "Account Url = $global:ElsAccountUrl" -Verbose

#Setting Headers and account Url accordingly
$headers = InitializeRestHeaders

#Upload the test drop
$elapsed = [System.Diagnostics.Stopwatch]::StartNew()
$drop = CreateTestDrop $headers

if ($drop.dropType -eq "TestServiceBlobDrop")
{
    $drop = GetTestDrop $drop $headers
    UploadTestDrop $drop $global:ScopedTestDrop
    WriteTaskMessages ("Uploading test files took {0}. Queuing the test run." -f $($elapsed.Elapsed.ToString()))

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

    if ($run.state -ne "completed")
    {
        Write-Error "Load test has failed. Please check error messages to fix the problem."
    }
    elseif ($global:ThresholdExceeded -eq $true)
    {
        Write-Error "Load test task is marked as failed, as the number of threshold errors has exceeded permissible limit."
    }
    else
    {
        WriteTaskMessages "The load test completed successfully."
    }

    Write-Output ("Run-id for this load test is {0} and its name is '{1}'." -f  $run.runNumber, $run.name)
    Write-Output "To view detailed results navigate to Load Test | Load Test Manager in Visual Studio IDE, and open this run."
}
else
{
    Write-Error ("Connection '{0}' failed for service '{1}'" -f $connectedServiceName, $connectedServiceDetails.Url.AbsoluteUri)
}

WriteTaskMessages "Finished Load Test Script"

