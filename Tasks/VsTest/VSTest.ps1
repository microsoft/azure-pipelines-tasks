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

    
function CmdletHasMember($memberName) {
    $publishParameters = (gcm Publish-TestResults).Parameters.Keys.Contains($memberName) 
    return $publishParameters
}

function SetRegistryKeyForParallel($vsTestVersion) {
    $regkey = "HKCU\SOFTWARE\Microsoft\VisualStudio\" + $vsTestVersion + "_Config\FeatureFlags\TestingTools\UnitTesting\Taef"
    reg add $regkey /v Value /t REG_DWORD /d 1 /f /reg:32
}

function IsVisualStudio2015Update1OrHigherInstalled($vsTestVersion) {
    $version = [int]($vsTestVersion)
    if($version -ge 14)
    {
        # checking for dll introduced in vs2015 update1
        # since path of the dll will change in dev15+ using vstestversion>14 as a blanket yes
        if(Test-Path "$env:VS140COMNTools\..\IDE\CommonExtensions\Microsoft\TestWindow\TE.TestModes.dll" -Or $version -gt 14)
        {
            # ensure the registry is set otherwise you need to launch VSIDE
            SetRegistryKeyForParallel $vsTestVersion
            
            return $true
        }
    }
    
    return $false
}

function SetupRunSettingsFileForParallel($runInParallelFlag, $runSettingsFilePath, $defaultCpuCount) {

    if($runInParallelFlag -eq "True")
    {        
        $runSettingsForParallel = [xml]'<?xml version="1.0" encoding="utf-8"?>'
        if([System.String]::IsNullOrWhiteSpace($runSettingsFilePath) -Or (-Not [io.path]::HasExtension($runSettingsFilePath)))  # no file provided so create one and use it for the run
        {
            Write-Verbose "No runsettings file provided"
            $runSettingsForParallel = [xml]'<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
  <RunConfiguration>
    <MaxCpuCount>0</MaxCpuCount>
  </RunConfiguration>
</RunSettings>
'
        }
        else 
        {
            Write-Verbose "Adding maxcpucount element to runsettings file provided"
            $runSettingsForParallel = [System.Xml.XmlDocument](Get-Content $runSettingsFilePath)
            $runConfigurationElement = $runSettingsForParallel.SelectNodes("//RunSettings/RunConfiguration")
            if($runConfigurationElement.Count -eq 0)
            {
                 $runConfigurationElement = $runSettingsForParallel.RunSettings.AppendChild($runSettingsFileXml.CreateElement("RunConfiguration"))
            }

            $maxCpuCountElement = $runSettingsForParallel.SelectNodes("//RunSettings/RunConfiguration/MaxCpuCount")
            if($maxCpuCountElement.Count -eq 0)
            {
                 $newMaxCpuCountElement = $runConfigurationElement.AppendChild($runSettingsForParallel.CreateElement("MaxCpuCount"))
            }    
        }

        $runSettingsForParallel.RunSettings.RunConfiguration.MaxCpuCount = $defaultCpuCount
        $tempFile = [io.path]::GetTempFileName()
        $runSettingsForParallel.Save($tempFile)
        Write-Verbose "Temporary runsettings file created at $tempFile"
        return $tempFile
    }
    return $runSettingsFilePath
}


Write-Verbose "Entering script VSTestConsole.ps1"

# Import the Task.Common and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
# Import the Task.TestResults dll that has the cmdlet we need for publishing results
import-module "Microsoft.TeamFoundation.DistributedTask.Task.TestResults"

if (!$testAssembly)
{
    Write-Host "##vso[task.logissue type=error;code=002001;]" 
    throw (Get-LocalizedString -Key "Test assembly parameter not set on script")
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
    Write-Host "##vso[task.logissue type=error;code=002002;]"
    throw "No source directory found."
}

# check for solution pattern
if ($testAssembly.Contains("*") -or $testAssembly.Contains("?"))
{
    Write-Verbose "Pattern found in solution parameter. Calling Find-Files."
    Write-Verbose "Calling Find-Files with pattern: $testAssembly"    
    $testAssemblyFiles = Find-Files -SearchPattern $testAssembly -RootFolder $sourcesDirectory
    Write-Verbose "Found files: $testAssemblyFiles"
}
else
{
    Write-Verbose "No Pattern found in solution parameter."
    $testAssemblyFiles = ,$testAssembly
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
    $testResultsDirectory = $workingDirectory + "\" + "TestResults"

    $rightVSVersionAvailable = IsVisualStudio2015Update1OrHigherInstalled $vsTestVersion
    if(-Not $rightVSVersionAvailable)
    {
        Write-Warning "Install Visual Studio 2015 Update 1 or higher on your build agent machine to run the tests in parallel."
        $runInParallel = "false"
    }
    
    $defaultCpuCount = "0"    
    $runSettingsFileWithParallel = [string](SetupRunSettingsFileForParallel $runInParallel $runSettingsFile $defaultCpuCount)
    
    Invoke-VSTest -TestAssemblies $testAssemblyFiles -VSTestVersion $vsTestVersion -TestFiltercriteria $testFiltercriteria -RunSettingsFile $runSettingsFileWithParallel -PathtoCustomTestAdapters $pathtoCustomTestAdapters -CodeCoverageEnabled $codeCoverage -OverrideTestrunParameters $overrideTestrunParameters -OtherConsoleOptions $otherConsoleOptions -WorkingFolder $workingDirectory -TestResultsFolder $testResultsDirectory -SourcesDirectory $sourcesDirectory

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
                    Write-Warning "Update the build agent to be able to opt out of test run attachment upload."
                }
                Publish-TestResults -Context $distributedTaskContext -TestResultsFiles $resultFiles -TestRunner "VSTest" -Platform $platform -Configuration $configuration -RunTitle $testRunTitle
            }
        }
        else
        {
            if($testRunTitle)
            {
                Write-Warning "Update the build agent to be able to use the custom run title feature."
            }
            
            if($publishRunLevelAttachmentsExists)		
            {
                Publish-TestResults -Context $distributedTaskContext -TestResultsFiles $resultFiles -TestRunner "VSTest" -Platform $platform -Configuration $configuration -PublishRunLevelAttachments $publishResultsOption
            }
            else
            {
                if(!$publishResultsOption)
                {
                    Write-Warning "Update the build agent to be able to opt out of test run attachment upload."
                }
                Publish-TestResults -Context $distributedTaskContext -TestResultsFiles $resultFiles -TestRunner "VSTest" -Platform $platform -Configuration $configuration
            }		
        }
    }
    else
    {
        Write-Host "##vso[task.logissue type=warning;code=002003;]"
        Write-Warning "No results found to publish."
    }
    
}
else
{
    Write-Host "##vso[task.logissue type=warning;code=002004;]"
    Write-Warning "No test assemblies found matching the pattern: $testAssembly"
}

Write-Verbose "Leaving script VSTestConsole.ps1"