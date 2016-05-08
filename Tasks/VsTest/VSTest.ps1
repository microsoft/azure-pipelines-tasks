[cmdletbinding()]
param(
    [string]$vsTestVersion, 
    [string]$testAssembly,
    [string]$testFiltercriteria,
    [string]$runSettingsFile,
    [string]$codeCoverageEnabled,
    [string]$pathtoCustomTestAdapters,
    [string]$overrideTestrunParameters,
    [string]$otherConsoleOptions,
    [string]$testRunTitle,
    [string]$platform,
    [string]$configuration,
    [string]$publishRunAttachments,
    [string]$runInParallel
    )

Write-Verbose "Entering script VSTest.ps1"
Write-Verbose "vsTestVersion = $vsTestVersion"
Write-Verbose "testAssembly = $testAssembly"
Write-Verbose "testFiltercriteria = $testFiltercriteria"
Write-Verbose "runSettingsFile = $runSettingsFile"
Write-Verbose "codeCoverageEnabled = $codeCoverageEnabled"
Write-Verbose "pathtoCustomTestAdapters = $pathtoCustomTestAdapters"
Write-Verbose "overrideTestrunParameters = $overrideTestrunParameters"
Write-Verbose "otherConsoleOptions = $otherConsoleOptions"
Write-Verbose "testRunTitle = $testRunTitle"
Write-Verbose "platform = $platform"
Write-Verbose "configuration = $configuration"
Write-Verbose "publishRunAttachments = $publishRunAttachments"

# Import the Task.Common and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
# Import the Task.TestResults dll that has the cmdlet we need for publishing results
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"

. $PSScriptRoot\Helpers.ps1

Write-Host "##vso[task.logissue type=warning;TaskName=VSTest]"

try
{
    if (!$testAssembly)
    {        
        throw (Get-LocalizedString -Key "No test assembly specified. Provide a test assembly parameter and try again.")
    }

    $sourcesDirectory = Get-TaskVariable -Context $distributedTaskContext -Name "Build.SourcesDirectory"
    if(!$sourcesDirectory)
    {
        # For RM, look for the test assemblies under the release directory.
        $sourcesDirectory = Get-TaskVariable -Context $distributedTaskContext -Name "Agent.ReleaseDirectory"
    }

    if(!$sourcesDirectory)
    {
        # If there is still no sources directory, error out immediately.        
        throw (Get-LocalizedString -Key "No source directory found.")
    }

    $testAssemblyFiles = @()
    # check for solution pattern
    if ($testAssembly.Contains("*") -Or $testAssembly.Contains("?"))
    {
        Write-Verbose "Pattern found in solution parameter. Calling Find-Files."
        Write-Verbose "Calling Find-Files with pattern: $testAssembly"    
        $testAssemblyFiles = Find-Files -SearchPattern $testAssembly -RootFolder $sourcesDirectory
        Write-Verbose "Found files: $testAssemblyFiles"
    }
    else
    {
        Write-Verbose "No Pattern found in solution parameter."
        $testAssembly = $testAssembly.Replace(';;', "`0") # Barrowed from Legacy File Handler
        foreach ($assembly in $testAssembly.Split(";"))
        {
            $testAssemblyFiles += ,($assembly.Replace("`0",";"))
        }
    }

    $codeCoverage = Convert-String $codeCoverageEnabled Boolean

    if($testAssemblyFiles)
    {
        Write-Verbose -Verbose "Calling Invoke-VSTest for all test assemblies"

        if($vsTestVersion -eq "latest")
        {
            # null out vsTestVersion before passing to cmdlet so it will default to the latest on the machine.
            $vsTestVersion = $null
        }

        $artifactsDirectory = Get-TaskVariable -Context $distributedTaskContext -Name "System.ArtifactsDirectory" -Global $FALSE

        $workingDirectory = $artifactsDirectory
        $testResultsDirectory = $workingDirectory + [System.IO.Path]::DirectorySeparatorChar + "TestResults"

        if($runInParallel -eq "True")
        {
            $rightVSVersionAvailable = IsVisualStudio2015Update1OrHigherInstalled $vsTestVersion
            if(-Not $rightVSVersionAvailable)
            {
                Write-Warning (Get-LocalizedString -Key "Install Visual Studio 2015 Update 1 or higher on your build agent machine to run the tests in parallel.")
                $runInParallel = "false"
            }
        }
    
        $defaultCpuCount = "0"    
        $runSettingsFileWithParallel = [string](SetupRunSettingsFileForParallel $runInParallel $runSettingsFile $defaultCpuCount)
    
        Invoke-VSTest -TestAssemblies $testAssemblyFiles -VSTestVersion $vsTestVersion -TestFiltercriteria $testFiltercriteria -RunSettingsFile $runSettingsFileWithParallel -PathtoCustomTestAdapters $pathtoCustomTestAdapters -CodeCoverageEnabled $codeCoverage -OverrideTestrunParameters $overrideTestrunParameters -OtherConsoleOptions $otherConsoleOptions -WorkingFolder $workingDirectory -TestResultsFolder $testResultsDirectory -SourcesDirectory $sourcesDirectory
    
    }
    else
    {
        Write-Host "##vso[task.logissue type=warning;code=002004;]"
        Write-Warning (Get-LocalizedString -Key "No test assemblies found matching the pattern: '{0}'." -ArgumentList $testAssembly)
    }
}
catch
{
    # Catching reliability issues and logging them here.
    Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=VSTest]"
    throw
}
finally
{
    try
    {
        # Try to publish test results, only if the results directory has been set.

        if($testResultsDirectory)
        {
            $resultFiles = Find-Files -SearchPattern "*.trx" -RootFolder $testResultsDirectory 

            $publishResultsOption = Convert-String $publishRunAttachments Boolean

            if($resultFiles)
            {
                # Remove the below hack once the min agent version is updated to S91 or above
                $runTitleMemberExists = CmdletHasMember "RunTitle"
                $publishRunLevelAttachmentsExists = CmdletHasMember "PublishRunLevelAttachments"
                if($runTitleMemberExists)
                {
                    if($publishRunLevelAttachmentsExists)
                    {
                        Publish-TestResults -Context $distributedTaskContext -TestResultsFiles $resultFiles -TestRunner "VSTest" -Platform $platform -Configuration $configuration -RunTitle $testRunTitle -PublishRunLevelAttachments $publishResultsOption
                    }
                    else
                    {
                        if(!$publishResultsOption)
                        {
                            Write-Warning (Get-LocalizedString -Key "Update the agent to try out the '{0}' feature." -ArgumentList "opt in/out of publishing test run attachments")
                        }
                        Publish-TestResults -Context $distributedTaskContext -TestResultsFiles $resultFiles -TestRunner "VSTest" -Platform $platform -Configuration $configuration -RunTitle $testRunTitle
                    }
                }
                else
                {
                    if($testRunTitle)
                    {
                        Write-Warning (Get-LocalizedString -Key "Update the agent to try out the '{0}' feature." -ArgumentList "custom run title")
                    }
            
                    if($publishRunLevelAttachmentsExists)		
                    {
                        Publish-TestResults -Context $distributedTaskContext -TestResultsFiles $resultFiles -TestRunner "VSTest" -Platform $platform -Configuration $configuration -PublishRunLevelAttachments $publishResultsOption
                    }
                    else
                    {
                        if(!$publishResultsOption)
                        {
                            Write-Warning (Get-LocalizedString -Key "Update the agent to try out the '{0}' feature." -ArgumentList "opt in/out of publishing test run attachments")
                        }
                        Publish-TestResults -Context $distributedTaskContext -TestResultsFiles $resultFiles -TestRunner "VSTest" -Platform $platform -Configuration $configuration
                    }		
                }
            }
            else
            {
                Write-Host "##vso[task.logissue type=warning;code=002003;]"
                Write-Warning (Get-LocalizedString -Key "No results found to publish.")
            }
        }
    }
    catch
    {
        Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=VSTest]"
        throw
    }
}

Write-Verbose "Leaving script VSTest.ps1"