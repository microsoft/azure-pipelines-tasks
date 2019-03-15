param(
    [string]$testMachineGroup,
    [string]$dropLocation,
    [string]$sourcefilters,
    [string]$testFilterCriteria,
    [string]$testRunTitle,
    [string]$platform,
    [string]$configuration,
    [string]$runSettingsFile,
    [string]$codeCoverageEnabled,
    [string]$overrideRunParams,
    [string]$testConfigurations,
    [string]$autMachineGroup,
    [string]$testSelection,
    [string]$testPlan,
    [string]$testSuite,
    [string]$testConfiguration,
    [string]$customSlicingEnabled

)

Function CmdletHasMember($memberName) {
    $cmdletParameter = (gcm Invoke-RunDistributedTests).Parameters.Keys.Contains($memberName) 
    return $cmdletParameter
}

Function Split-Parameters
{
    param 
    ( 
        [String] 
        $OverridingParameters,

        [String] 
        $Separator,

        [Char]
        $EscapeCharacter
    )
   
    $inputStr = $OverridingParameters
    $parameterStrings = New-Object System.Collections.Generic.List[String]
    $startOfSegment = 0
    $index = 0

    while ($index -ilt $inputStr.Length)
    {
        $index = $inputStr.indexOf($Separator, $index)
        if ($index -gt 0 -and $inputStr[$index - 1] -eq $EscapeCharacter)
        {
            $index += $Separator.Length
            continue
        }
        if ($index -eq -1)
        {
            break
        }
        $parameterStrings.Add($inputStr.Substring($startOfSegment, $index - $startOfSegment).Replace($EscapeCharacter + $Separator, $Separator))
        $index += $Separator.Length
        $startOfSegment = $index
    }
    $parameterStrings.Add($inputStr.Substring($startOfSegment).Replace($EscapeCharacter + $Separator, $Separator))

    return $parameterStrings
}

Function Get-PropertiesMapping 
{
    param 
    ( 
        [String] 
        $OverridingParameters 
    )
        
    $parameterStrings = Split-Parameters -OverridingParameters $OverridingParameters -Separator ";" -EscapeCharacter '\'
    $properties = New-Object 'system.collections.generic.dictionary[string,string]'
    
    foreach ($s in $parameterStrings)
    {
        $pair = $s.Split('=', 2)
        if ($pair.Length -eq 2)
        {
            if (!$properties.ContainsKey($pair[0]))
            {
                $properties.Add($pair[0], $pair[1])
            }
        }
    }
    
    return $properties
}
    
Function Override-TestSettingProperties 
{
    param 
    (
        [String]
        $OverridingParameters, 
       
        [System.Xml.XmlDocument] 
        $TestSettingsXmlDoc
    )
    
    $properties = Get-PropertiesMapping -OverridingParameters $OverridingParameters
    $propertyNodes = $TestSettingsXmlDoc.TestSettings.Properties.ChildNodes
    $hasOverridenProperties  = $false
    
    foreach($property in $propertyNodes)
    {       
        if ([string]::CompareOrdinal($property.LocalName, "Property") -ne 0 ) 
        { 
            continue 
        } 

        $nameAttribute = $property.name
        $valueAttribute = $property.value
        
        if(-not $nameAttribute) 
        { 
            $nameAttribute = $property.Name 
        }

        if(-not $valueAttribute) 
        { 
            $valueAttribute = $property.Value 
        }
            
        if (-not ($nameAttribute -and $valueAttribute))
        { 
            continue 
        }
             
        if ($properties.ContainsKey($nameAttribute))
        {
            $hasOverridenProperties = $true
            Write-Verbose "Overriding value for parameter : $nameAttribute" 
            if($property.value)
            {
                $property.value = $properties[$nameAttribute]
            }
            elseif($property.Value)
            {
                $property.Value = $properties[$nameAttribute]
            }
        }
    }
    
    return $hasOverridenProperties
}

Write-Warning "This task and it’s companion task (Visual Studio Test Agent Deployment) are now deprecated and will stop working on 10-March-2019. Use the 'Visual Studio Test' task instead. The VSTest task can run unit as well as functional tests. Run tests on one or more agents using the multi-agent phase setting. Use the ‘Visual Studio Test Platform’ task to run tests without needing Visual Studio on the agent. VSTest task also brings new capabilities such as automatically rerunning failed tests. Visit https://aka.ms/testingwithphases for more information."
Write-Verbose "Entering script RunDistributedTests.ps1"
Write-Verbose "TestMachineGroup = $testMachineGroup"
Write-Verbose "Test Drop Location = $dropLocation"
Write-Verbose "Source Filter = $sourcefilters"
Write-Verbose "Test Filter Criteria = $testFilterCriteria"
Write-Verbose "RunSettings File = $runSettingsFile"
Write-Verbose "Build Platform = $platform"
Write-Verbose "Build Configuration = $configuration"
Write-Verbose "CodeCoverage Enabled = $codeCoverageEnabled"
Write-Verbose "TestRun Parameters to override = $overrideRunParams"
Write-Verbose "TestConfiguration = $testConfigurations"
Write-Verbose "Application Under Test Machine Group = $autTestMachineGroup"


# Import the Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.DTA"

Write-Verbose "Getting the connection object"
$connection = Get-VssConnection -TaskContext $distributedTaskContext

# Get current directory.
$currentDirectory = Convert-Path .
$unregisterTestAgentScriptLocation = Join-Path -Path $currentDirectory -ChildPath "TestAgentUnRegistration.ps1"
$checkTaCompatScriptLocation = Join-Path -Path $currentDirectory -ChildPath "CheckTestAgentCompat.ps1"
Write-Verbose "UnregisterTestAgent script Path  = $unRegisterTestAgentLocation"

Write-Verbose "Calling Invoke-RunDistributedTests"

$checkTestAgentCompatScriptLocationMemberExists  = CmdletHasMember "CheckTestAgentCompatScriptLocation"
$checkCustomSlicingEnabledMemberExists  = CmdletHasMember "CustomSlicingEnabled"
$taskContextMemberExists  = CmdletHasMember "TaskContext"

# Error out unless there is a workaround
$supportrft = Get-TaskVariable -Context $distributedTaskContext -Name "RFTSupport"
if ($supportrft -notlike 'true')
{
    throw "This task and its companion task (Visual Studio Test Agent Deployment) are now not supported. Use the 'Visual Studio Test' task instead. The VSTest task can run unit as well as functional tests. Run tests on one or more agents using the multi-agent phase setting. Use the 'Visual Studio Test Platform' task to run tests without needing Visual Studio on the agent. VSTest task also brings new capabilities such as automatically rerunning failed tests. Visit https://aka.ms/testingwithphases for more information."
}

if($overrideRunParams -and $runSettingsFile -and (Test-Path $runSettingsFile))
{
    if (([string]::Compare([io.path]::GetExtension($runSettingsFile), ".testsettings", $True) -eq 0)) 
    {
        $settingsXML = $null 
        try
        {
            $settingsXML = [xml](Get-Content $runSettingsFile)
        }
        catch 
        {
            Write-Verbose "Exception occurred reading provided testsettings $_.Exception.message "
        }
        if($settingsXML -eq $null -or (-not $settingsXML.TestSettings) )
        {
            Write-Warning "The specified testsettings file $runSettingsFile is invalid or does not exist. Provide a valid settings file or clear the field."
        }
        else
        {
            $hasOverridenProperties = Override-TestSettingProperties -OverridingParameters $overrideRunParams -TestSettingsXmlDoc $settingsXML
            if($hasOverridenProperties)
            {
                $newTestSettingsFile = [io.path]::Combine($env:TEMP, ([GUID]::NewGuid()).toString() + ".testsettings" )
                $settingsXML.Save($newTestSettingsFile)
                Write-Verbose "Task will be using new TestSettings file created after overriding properties : $newTestSettingsFile"
                $runSettingsFile = $newTestSettingsFile
            }
        }
        # Resetting overrideRunParams as we have already overriden them. Also needed to avoid not supported error of cmdlet.
        $overrideRunParams = $null
    }
}

$suites = $testSuite.Split(",")
$testSuites = @()
foreach ($suite in $suites)
{
    $suiteId = 0
    if([int]::TryParse($suite, [ref]$suiteId))
    {
        $testSuites += $suiteId
    }    
}

$testPlanId = 0
if([int]::TryParse($testPlan, [ref]$testPlanId)){}

$testConfigurationId = 0
if([int]::TryParse($testConfiguration, [ref]$testConfigurationId)){}

$customSlicingEnabledFlag = $false
if([bool]::TryParse($customSlicingEnabled, [ref]$customSlicingEnabledFlag)){}
 
if([string]::Equals($testSelection, "testPlan")) 
{
    if($checkCustomSlicingEnabledMemberExists)
    {
        try
        {	
            Write-Verbose "Invoking Run Distributed Tests with Register Environment support"
    
            Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter "*.dll" -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle -TestSelection $testSelection -TestPlan $testPlanId -TestSuites $testSuites -TestConfig $testConfigurationId -TaskContext $distributedTaskContext -CheckTestAgentCompatScriptLocation $checkTaCompatScriptLocation -CustomSlicingEnabled $customSlicingEnabledFlag
	    }
        catch
        {
            Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=DTA]"
            throw
        }
    }
    elseif($checkTestAgentCompatScriptLocationMemberExists)
    {
        if($customSlicingEnabledFlag)
        {
            Write-Warning "Update the build agent to run tests with uniform distribution. If you are using hosted agent there are chances that it is still not updated, so retry using your own agent."
        }
        try
        {	
            if($taskContextMemberExists)
            {
                Write-Verbose "Invoking Run Distributed Tests with Register Environment support"
    
                Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter "*.dll" -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle -TestSelection $testSelection -TestPlan $testPlanId -TestSuites $testSuites -TestConfig $testConfigurationId -TaskContext $distributedTaskContext -CheckTestAgentCompatScriptLocation $checkTaCompatScriptLocation
            }
            else
            {
                Write-Verbose "Invoking Run Distributed Tests with Machine Group Confg"
            
                Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter "*.dll" -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFilePreview -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabledPreview -TestRunParams $overrideRunParamsPreview -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle -TestSelection $testSelection -TestPlan $testPlanId -TestSuites $testSuites -TestConfig $testConfigurationId -CheckTestAgentCompatScriptLocation $checkTaCompatScriptLocation
            }  
	    }
        catch
        {
            Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=DTA]"
            throw
        }
    }
    else
    {
        throw (Get-LocalizedString -Key "Update the build agent to run tests from test plan. If you are using hosted agent there are chances that it is still not updated, so retry using your own agent.")
    }
}
else
{
    if($checkCustomSlicingEnabledMemberExists)
    {
        try
        {	
            Write-Verbose "Invoking Run Distributed Tests with Register Environment support"
        
            Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle -TaskContext $distributedTaskContext -CustomSlicingEnabled $customSlicingEnabledFlag
	    }
        catch
        {
            Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=DTA]"
            throw
        }
    }
	else 
	{
        if($customSlicingEnabledFlag)
        {
            Write-Warning "Update the build agent to run tests with uniform distribution. If you are using hosted agent there are chances that it is still not updated, so retry using your own agent."
        }
        try
        {
            if($taskContextMemberExists)
            {
                Write-Verbose "Invoking Run Distributed Tests with Register Environment support"
        
                Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle -TaskContext $distributedTaskContext
            }
            else
            {
                Write-Verbose "Invoking Run Distributed Tests with Machng Group Confg"
        
                Invoke-RunDistributedTests -TestMachineGroup $testMachineGroup -SourceFilter $sourcefilters -TestCaseFilter $testFilterCriteria -RunSettingsPath $runSettingsFile -Platform $platform -Configuration $configuration -CodeCoverageEnabled $codeCoverageEnabled -TestRunParams $overrideRunParams -TestDropLocation $dropLocation -Connection $connection -TestConfiguration $testConfigurations -AutMachineGroup $autMachineGroup -UnregisterTestAgentScriptLocation $unregisterTestAgentScriptLocation -TestRunTitle $testRunTitle
            }
        }
        catch
        {
            Write-Host "##vso[task.logissue type=error;code=" $_.Exception.Message ";TaskName=DTA]"
            throw
        }
    }
}

if (([string]::Compare([io.path]::GetExtension($runSettingsFile), ".tmp", $True) -eq 0) -or $hasOverridenProperties)
{
    Write-Host "Removing temp settings file : $runSettingsFile"
    Remove-Item $runSettingsFile
}