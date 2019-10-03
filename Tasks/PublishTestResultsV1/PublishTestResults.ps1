param(
    [string]$testRunner,    
    [string]$testResultsFiles,
    [string]$mergeTestResults,
    [string]$testRunTitle,
    [string]$platform,
    [string]$configuration,
    [string]$publishRunAttachments
)

Function CmdletHasMember($memberName) {
    $publishParameters = (gcm Publish-TestResults).Parameters.Keys.Contains($memberName) 
    return $publishParameters
}

Write-Verbose "Entering script PublishTestResults.ps1"

try {
	# Force powershell to use TLS 1.2 for all communications.
	[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls11 -bor [System.Net.SecurityProtocolType]::Tls10;
}
catch {
	Write-Warning $error
}

# Import the Task.Common, Task.Internal and Task.TestResults dll that has all the cmdlets we need
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"


try
{
    if(!$testRunner)
    {        
        throw (Get-LocalizedString -Key "Test runner parameter has to be specified")
    }

    if (!$testResultsFiles)
    {        
        throw (Get-LocalizedString -Key "Test results files parameter has to be specified")
    }

    # check for pattern in testResultsFiles
    if ($testResultsFiles.Contains("*") -or $testResultsFiles.Contains("?"))
    {
        Write-Verbose "Pattern found in testResultsFiles parameter."
        Write-Verbose "Find-Files -SearchPattern $testResultsFiles"
        $matchingTestResultsFiles = Find-Files -SearchPattern $testResultsFiles
        Write-Verbose "matchingTestResultsFiles = $matchingTestResultsFiles"
    }
    else
    {
        Write-Verbose "No Pattern found in testResultsFiles parameter."
        $matchingTestResultsFiles = ,$testResultsFiles
    }

    if (!$matchingTestResultsFiles)
    {
        Write-Warning (Get-LocalizedString -Key "No test result files were found using search pattern '{0}'." -ArgumentList $testResultsFiles)
    }
    else
    {
        $switchToPowerShell = Get-TaskVariable -Context $distributedTaskContext -Name "UsePowerShellScripts"
        $agentVersionVar = Get-TaskVariable -Context $distributedTaskContext -Name "Agent.Version"
        Write-Verbose "Agent Version: $agentVersionVar"

        try {
            $agentVersion = [version]$agentVersionVar;
        }
        catch {
            Write-Verbose "Invalid Agent version : $agentVersionVar";
        }

        # There's a Null reference exception introduced in the agent 2.138 until 2.138.4 and hot fixed in 2.138.5.
        # Hence falling back to Scripts to pulblish test results. If Agent version falls between 2.138 .. 2.138.4
        if (!$agentVersion -or (($agentVersion -ge [version]"2.138") -and ($agentVersion -le [version]"2.138.4"))) {
            $switchToPowerShell = "true";
        }

        if ($switchToPowerShell -ieq "true") {
            Write-Verbose "Using the powershell scripts to publish test results"
        }
        else {
            Write-Verbose "Using Agent Command to publish test results"

            foreach($file in $matchingTestResultsFiles) {
                if ($file -match ",") {
                    Write-Warning "File names containing , are not supported. Please rename the resutls file:$file";
                }
            }

            $matchingTestResultsFiles = [string]::Join(",", $matchingTestResultsFiles);
        }

        $testRunSystem = "VSTS - PTR";
        $publishResultsOption = Convert-String $publishRunAttachments Boolean
        $mergeResults = Convert-String $mergeTestResults Boolean
        Write-Verbose "Calling Publish-TestResults"
        
        $publishRunLevelAttachmentsExists = CmdletHasMember "PublishRunLevelAttachments"
        $runTitleMemberExists = CmdletHasMember "RunTitle"
        if(!($runTitleMemberExists))
        {
            if(!([string]::IsNullOrWhiteSpace($testRunTitle)))
            {
                Write-Warning "Update the build agent to be able to use the custom run title feature."
            }

            if($publishRunLevelAttachmentsExists)
            {
                if ($switchToPowerShell -ieq "true") {
                    Publish-TestResults -TestRunner $testRunner -TestResultsFiles $matchingTestResultsFiles -MergeResults $mergeResults -Platform $platform -Configuration $configuration -Context $distributedTaskContext -PublishRunLevelAttachments $publishResultsOption
                }
                else {
                    Write-Host "##vso[results.publish type=$testRunner;mergeResults=$mergeResults;publishRunAttachments=$publishResultsOption;resultFiles=$matchingTestResultsFiles;platform=$platform;config=$configuration;testRunSystem=$testRunSystem;]"
                }
            }
            else 
            {
                if(!$publishResultsOption)
                {
                    Write-Warning "Update the build agent to be able to opt out of test run attachment upload." 
                }
                if ($switchToPowerShell -ieq "true") {
                    Publish-TestResults -TestRunner $testRunner -TestResultsFiles $matchingTestResultsFiles -MergeResults $mergeResults -Platform $platform -Configuration $configuration -Context $distributedTaskContext
                }
                else {
                    Write-Host "##vso[results.publish type=$testRunner;mergeResults=$mergeResults;resultFiles=$matchingTestResultsFiles;platform=$platform;config=$configuration;testRunSystem=$testRunSystem;]"
                }
            }
        }
        else
        {
            if($publishRunLevelAttachmentsExists)
            {
                if ($switchToPowerShell -ieq "true") {
                    Publish-TestResults -TestRunner $testRunner -TestResultsFiles $matchingTestResultsFiles -MergeResults $mergeResults -Platform $platform -Configuration $configuration -Context $distributedTaskContext -PublishRunLevelAttachments $publishResultsOption -RunTitle $testRunTitle
                }
                else {
                    Write-Host "##vso[results.publish type=$testRunner;mergeResults=$mergeResults;publishRunAttachments=$publishResultsOption;resultFiles=$matchingTestResultsFiles;platform=$platform;config=$configuration;testRunSystem=$testRunSystem;runTitle=$testRunTitle;]"
                }
            }
            else 
            {
                if(!$publishResultsOption)
                {
                    Write-Warning "Update the build agent to be able to opt out of test run attachment upload." 
                }
                if ($switchToPowerShell -ieq "true") {
                    Publish-TestResults -TestRunner $testRunner -TestResultsFiles $matchingTestResultsFiles -MergeResults $mergeResults -Platform $platform -Configuration $configuration -Context $distributedTaskContext -RunTitle $testRunTitle
                }
                else {
                    Write-Host "##vso[results.publish type=$testRunner;mergeResults=$mergeResults;resultFiles=$matchingTestResultsFiles;platform=$platform;config=$configuration;testRunSystem=$testRunSystem;runTitle=$testRunTitle;]"
                }
            }
        }
    }
}
catch
{
    Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=PublishTestResults]"
    throw
}

Write-Verbose "Leaving script PublishTestResults.ps1"