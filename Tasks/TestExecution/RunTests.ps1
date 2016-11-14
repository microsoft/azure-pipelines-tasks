[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
try {
    Import-VstsLocStrings "$PSScriptRoot\Task.json"

    # Get the inputs.
    $adminUserName = Get-VstsInput -Name adminUserName -Require
    $adminPassword = Get-VstsInput -Name adminPassword -Require
    $testUserName = Get-VstsInput -Name testUserName -Require
    $testUserPassword = Get-VstsInput -Name testUserPassword -Require
    $testDropLocation = Get-VstsInput -Name dropLocation -Require
    $runUITests = Get-VstsInput -Name runUITests -Require
    $testSelection = Get-VstsInput -Name testSelection -Require
    $testPlan = Get-VstsInput -Name testPlan
    $testSuite = Get-VstsInput -Name testSuite
    $testPlanConfigId = Get-VstsInput -Name testPlanConfigId
    $sourcefilters = Get-VstsInput -Name sourcefilters
    $testFilterCriteria = Get-VstsInput -Name testFilterCriteria
    $runSettingsFile = Get-VstsInput -Name runSettingsFile
    $overrideRunParams = Get-VstsInput -Name overrideRunParams
    $codeCoverageEnabled = Get-VstsInput -Name codeCoverageEnabled
    $customSlicingEnabled = Get-VstsInput -Name customSlicingEnabled
    $testRunTitle = Get-VstsInput -Name testRunTitle
    $buildPlatform = Get-VstsInput -Name buildPlatform
    $buildConfiguration = Get-VstsInput -Name buildConfiguration
    $autMachineGroup = Get-VstsInput -Name autMachineGroup

    Write-Host "****************************************************************"
    Write-Host "                    Task Input Information                      "
    Write-Host "----------------------------------------------------------------"
    Write-Host "adminUserName                   : ($adminUserName)"
    Write-Host "testUserName                    : ($testUserName)"
    Write-Host "testDropLocation                : ($testDropLocation)"
    Write-Host "runUITests                      : ($runUITests)"
    Write-Host "testSelection                   : ($testSelection)"
    Write-Host "testSuite                       : ($testSuite)"
    Write-Host "testPlanConfigId                : ($testPlanConfigId)"
    Write-Host "sourcefilters                   : ($sourcefilters)"
    Write-Host "testFilterCriteria              : ($testFilterCriteria)"
    Write-Host "runSettingsFile                 : ($runSettingsFile)"
    Write-Host "overrideRunParams               : ($overrideRunParams)"
    Write-Host "codeCoverageEnabled             : ($codeCoverageEnabled)"
    Write-Host "customSlicingEnabled            : ($customSlicingEnabled)"
    Write-Host "testRunTitle                    : ($testRunTitle)"
    Write-Host "buildPlatform                   : ($buildPlatform)"
    Write-Host "buildConfiguration              : ($buildConfiguration)"
    Write-Host "autMachineGroup                 : ($autMachineGroup)"
    Write-Host "****************************************************************"

    # Import the helpers.
    . $PSScriptRoot\DownloadTestPlatform.ps1
    . $PSScriptRoot\TestAgentConfiguration.ps1
    Import-Module "$PSScriptRoot\modules\TFS.Modules\Microsoft.TeamFoundation.DistributedTask.Task.TestExecution.dll"

    # Fix Assembly Redirections
    # VSTS uses Newton Json 8.0 while the System.Net.Http uses 6.0
    # Redirection to Newton Json 8.0
    $jsonAssembly = [reflection.assembly]::LoadFrom($PSScriptRoot + "\modules\TFS.Modules\Newtonsoft.Json.dll") 
    $onAssemblyResolve = [System.ResolveEventHandler] {
        param($sender, $e)
        if ($e.Name -eq "Newtonsoft.Json, Version=6.0.0.0, Culture=neutral, PublicKeyToken=30ad4fe6b2a6aeed") { return $jsonAssembly }
        foreach($a in [System.AppDomain]::CurrentDomain.GetAssemblies())
        {
            if($a.FullName -eq $e.Name) { return $a } else { return $null }
        }
        return $null
    }
    [System.AppDomain]::CurrentDomain.add_AssemblyResolve($onAssemblyResolve)

    # Get PAT Token, Collection URL etc.
    $endpoint = (Get-VstsEndpoint -Name SystemVssConnection -Require)
    $personalAccessToken = [string]$endpoint.auth.parameters.AccessToken
    $tfsCollectionUrl = Get-VstsTaskVariable -Name System.TeamFoundationCollectionUri -Require
    $releaseId = Get-VstsTaskVariable -Name Release.ReleaseId -Require
    $phaseId = Get-VstsTaskVariable -Name Release.DeployPhaseId -Require
    $phaseExecutionModel = Get-VstsTaskVariable -Name System.ParallelExecutionType -Require 

    # Generate Environment URI
    # This is uniqure environment URI for each DTA Run. One can dynamically add machines by overrriding this with current URI
    $taskInstanceIdString = Get-VstsTaskVariable -Name DTA_INSTANCE_ID
    $taskInstanceId = 1
    
    if($taskInstanceIdString) {
        [int]::TryParse($taskInstanceIdString, [ref]$taskInstanceId)
        $taskInstanceId++
    }
    
    Set-VstsTaskVariable -Name DTA_INSTANCE_ID -Value $taskInstanceId

    $taskInstanceId = Get-VstsTaskVariable -Name DTA_INSTANCE_ID
    $environmentUri = "dta://env/Test/_apis/release/$releaseId/$phaseId/$taskInstanceId"

    # *** Todo ***
    # Handle errors properly
    # Uniform code naming and refactoring
    # Add support for Willow
    # Get testrun agaisnt Environment -> if it's already completed -> quit //Improvement

    # Downlaod and Configure Test platform
    # DownloadTestPlatform -ProductVersion "14.0"
    $asServiceOrProcess = if($runUITests -ieq "false") {"Service"} else {"Process"}
    # Trim out spaces from username.
    $returnCode = ConfigureTestAgent -AdminUserName ($adminUserName.Trim()) -AdminPassword $adminPassword -TestUserName ($testUserName.Trim()) -TestUserPassword $testUserPassword -TfsCollection $tfsCollectionUrl -EnvironmentUrl $environmentUri -PersonalAccessToken $personalAccessToken -AsServiceOrProcess $asServiceOrProcess

    # Start the execution of Distributed Test Runs
    $testRunParameters = New-Object 'System.Collections.Generic.Dictionary[String,Object]'
    $testRunParameters.Add("AccessToken", $personalAccessToken);
    $testRunParameters.Add("SourceFilter", $sourcefilters);
    $testRunParameters.Add("TestCaseFilter", $testFilterCriteria);
    $testRunParameters.Add("RunSettings", $runSettingsFile);
    $testRunParameters.Add("TestDropLocation", $testDropLocation);
    $testRunParameters.Add("TestRunParams", $overrideRunParams);
    $testRunParameters.Add("CodeCoverageEnabled", $codeCoverageEnabled);
    $testRunParameters.Add("BuildConfig", $buildConfiguration);
    $testRunParameters.Add("BuildPlatform", $buildPlatform);
    $testRunParameters.Add("TestConfigurationMapping", $testConfiguration);
    $testRunParameters.Add("TestRunTitle", $testRunTitle);
    $testRunParameters.Add("TestSelection", $testSelection);
    $testRunParameters.Add("TestPlan", $testPlan);
    $testRunParameters.Add("TestSuites", $testSuite);
    $testRunParameters.Add("TestPlanConfigId", $testPlanConfigId);
    $testRunParameters.Add("CustomSlicingEnabled", $customSlicingEnabled);
    $testRunParameters.Add("EnvironmentUri", $environmentUri);
    
    $runTests = New-Object 'Microsoft.TeamFoundation.DistributedTask.Task.TestExecution.RunTests'
    $runTests.StartExecution($testRunParameters)

} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}