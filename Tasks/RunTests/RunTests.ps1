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
    . $PSScriptRoot\TestAgentConfiguration.ps1
    . $PSScriptRoot\CheckTestAgentInstallation.ps1
    Import-Module "$PSScriptRoot\modules\Microsoft.TeamFoundation.DistributedTask.Task.RunTests.dll"

    # Fix Assembly Redirections
    # VSTS uses Newton Json 8.0 while the System.Net.Http uses 6.0
    # Redirection to Newton Json 8.0
    $jsonAssembly = [reflection.assembly]::LoadFrom($PSScriptRoot + "\modules\Newtonsoft.Json.dll") 
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

    # Get PAT Token, Collection URL and Phase info
    $endpoint = (Get-VstsEndpoint -Name SystemVssConnection -Require)
    $personalAccessToken = [string]$endpoint.auth.parameters.AccessToken
    $tfsCollectionUrl = Get-VstsTaskVariable -Name System.TeamFoundationCollectionUri -Require
    $phaseId = Get-VstsTaskVariable -Name Release.DeployPhaseId -Require  # *** There has to be common variable across Build and RM and instance id usage *** 

    # Generate Environment URI
    # This is uniqure environment URI for each DTA Run. One can dynamically add machines by overrriding this with current URI
    $environmentUri = "dta://env/Test/_apis/1/$phaseId" # This should be shared job id and task instance id hash

    # *** Todo Improvement ***
    # Get testrun agaisnt Environment -> if it's already completed -> quit
    # Handle errors properly
    # Uniform code naming and refactoring
    # Add support for Willow

    # Check if test agent is already installed 
    $isTaInstalled = CheckInstallation -ProductVersion "14.0"
    if(-Not $isTaInstalled) {
        # Import Agent installation helpers
        . $PSScriptRoot\DownloadTestAgent.ps1
        . $PSScriptRoot\TestAgentInstall.ps1

        $sourcePath = "https://go.microsoft.com/fwlink/?LinkId=615472"
        $destPath = Join-Path "$env:SystemDrive" "TestAgent"
        $taPath = Join-Path $destPath "vstf_testagent.exe"

        Write-Verbose "Test Agent is not installed. It will be downloaded and installed"
        Write-Host "Downloading from $sourcePath to $destPath"
        
        DownloadTestAgent -SourcePath $sourcePath -DestinationPath $destPath
        $installationCode = Install-Product -SetupPath $taPath -ProductVersion "14.0" -Arguments "/Quiet /NoRestart"
        
        Write-Host "Test Agent installation is completed with code: $installationCode" 
    }

    # Configure Test Agent
    $asServiceOrProcess = if($runUITests -ieq "false") {"Service"} else {"Process"}
    # Trim out spaces from username and passwords.
    $returnCode = ConfigureTestAgent -AdminUserName ($adminUserName.Trim()) -AdminPassword $adminPassword -TestUserName ($testUserName.Trim()) -TestUserPassword $testUserPassword -TfsCollection $tfsCollectionUrl -EnvironmentUrl $environmentUri -PersonalAccessToken $personalAccessToken -AsServiceOrProcess $asServiceOrProcess

    # Start the execution of Distributed Test Runs
    $testRunParameters = New-Object 'System.Collections.Generic.Dictionary[String,Object]'
    $testRunParameters.Add("AccessToken",$personalAccessToken);
    $testRunParameters.Add("SourceFilter",$sourcefilters);
    $testRunParameters.Add("TestCaseFilter",$testFilterCriteria);
    $testRunParameters.Add("RunSettings",$runSettingsFile);
    $testRunParameters.Add("TestDropLocation",$testDropLocation);
    $testRunParameters.Add("TestRunParams",$overrideRunParams);
    $testRunParameters.Add("CodeCoverageEnabled",$codeCoverageEnabled);
    $testRunParameters.Add("BuildConfig",$buildConfiguration);
    $testRunParameters.Add("BuildPlatform",$buildPlatform);
    $testRunParameters.Add("TestConfigurationMapping",$testConfiguration);
    $testRunParameters.Add("TestRunTitle",$testRunTitle);
    $testRunParameters.Add("TestSelection",$persontestSelectionalAccessToken);
    $testRunParameters.Add("TestPlan",$testPlan);
    $testRunParameters.Add("TestSuites",$null);
    $testRunParameters.Add("TestPlanConfigId",$testPlanConfigId);
    $testRunParameters.Add("CustomSlicingEnabled",$customSlicingEnabled);
    $testRunParameters.Add("EnvironmentUri",$environmentUri);
    
   $runTests = New-Object Microsoft.TeamFoundation.DistributedTask.Task.RunTests.RunTests
   $runTests.StartExecution($testRunParameters)

} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}
