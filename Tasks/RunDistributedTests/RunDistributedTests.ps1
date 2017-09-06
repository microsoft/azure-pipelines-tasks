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

#To parse the Overriding Parameters string provided by user
Function GetPropertiesMapping {
    param ( [String] $overridingParameters )
    
        $inputStr = $overridingParameters
        $parameterStrings = New-Object System.Collections.Generic.List[String]
        $startOfSegment = 0;
        $index = 0;
    
        $separator = ";" 
        $escapeCharacter = '\'
    
        while ($index -ilt $inputStr.Length)
        {
            $index = $inputStr.indexOf($separator, $index);
            if ($index -gt 0 -and $inputStr[$index - 1] -eq $escapeCharacter)
            {
                $index += $separator.Length;
                continue; 
            }
            if ($index -eq -1)
            {
                break;
            }
            $parameterStrings.Add($inputStr.Substring($startOfSegment, $index - $startOfSegment).Replace($escapeCharacter + $separator, $separator));
            $index += $separator.Length;
            $startOfSegment = $index;
        }
        $parameterStrings.Add($inputStr.Substring($startOfSegment).Replace($escapeCharacter + $separator, $separator));
        
        $properties = New-Object 'system.collections.generic.dictionary[string,string]'
        foreach ($s in $parameterStrings)
        {
            $pair = $s.Split('=', 2);
            if ($pair.Length -eq 2)
            {
               if (!$properties.ContainsKey($pair[0]))
               {
                    $properties.Add($pair[0], $pair[1])
               }
            }
        }
        return $properties;
    }
    
Function OverrideTestSettingProperties {
    param (
    [String] $overridingParameters, 
    [System.Xml.XmlDocument] $testSettings
    )
    
        if([String]::IsNullOrEmpty($overridingParameters) -or $testSettings -eq $null)
        {
            return $false
        }
    
        $properties = GetPropertiesMapping -overridingParameters $overridingParameters
        $propertyNodes = $testSettings.TestSettings.Properties.ChildNodes
    
        $hasOverridenProperties  = $false;
        foreach($property in $propertyNodes)
        {       
            if ([string]::CompareOrdinal($property.LocalName, "Property") -ne 0 ) { continue } 
    
            $nameAttribute = $property.name
            $valueAttribute = $property.value
    
            if(-not $nameAttribute) { $nameAttribute = $property.Name }
    
            if(-not $valueAttribute) { $valueAttribute = $property.Value }
            
            if (-not ($nameAttribute -and $valueAttribute)) { continue }
             
            if ($properties.ContainsKey($nameAttribute))
            {
                $hasOverridenProperties = $true
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

if($overrideRunParams -and $runSettingsFile -and (Test-Path $runSettingsFile))
{
    if (([string]::Compare([io.path]::GetExtension($runSettingsFile), ".testsettings", $True) -eq 0)) {
        $xml = [xml](Get-Content $runSettingsFile)
        $hasOverridenProperties = OverrideTestSettingProperties -overridingParameters $overrideRunParams -testSettings $xml
        if($hasOverridenProperties)
        {
            $newTestSettingsFile = [io.path]::Combine($env:TEMP, ([GUID]::NewGuid()).toString() + ".testsettings" )
            $xml.Save($newTestSettingsFile)
            Write-Verbose "Task will be using new TestSettings file created after overriding properties : $newTestSettingsFile"
            $runSettingsFile = $newTestSettingsFile
            # Resetting run params as we have already overriden them in test settiings file
            $overrideRunParams = $null
        }
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