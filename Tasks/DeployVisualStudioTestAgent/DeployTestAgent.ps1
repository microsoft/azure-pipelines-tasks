[CmdletBinding()]
param()
 
Trace-VstsEnteringInvocation $MyInvocation
try {
    Import-VstsLocStrings "$PSScriptRoot\Task.json"

    $testMachines               = Get-VstsInput -Name testMachines -Require
    $adminUserName              = Get-VstsInput -Name adminUserName -Require
    $adminPassword              = Get-VstsInput -Name adminPassword -Require
    $winRmProtocol              = Get-VstsInput -Name winRmProtocol -Require
    $testCertificate            = Get-VstsInput -Name testCertificate
    $machineUserName            = Get-VstsInput -Name machineUserName -Require
    $machinePassword            = Get-VstsInput -Name machinePassword -Require
    $runAsProcess               = Get-VstsInput -Name runAsProcess
    $isDataCollectionOnly       = Get-VstsInput -Name isDataCollectionOnly
    $testPlatform               = Get-VstsInput -Name testPlatform -Require
    $agentLocation              = Get-VstsInput -Name agentLocation
    $updateTestAgent            = Get-VstsInput -Name updateTestAgent

    # If Run as process (Run UI Tests) is true both autologon and disable screen saver needs to be true.
    $logonAutomatically = $runAsProcess
    $disableScreenSaver = $runAsProcess

    Write-Host "****************************************************************"
    Write-Host "                    Task Input Information                      "
    Write-Host "----------------------------------------------------------------"
    Write-Host "testMachineInput         = $testMachines"
    Write-Host "adminUserName            = $adminUserName"
    Write-Host "winRmProtocal            = $winRmProtocol"
    Write-Host "testCertificate          = $testCertificate"
    Write-Host "machineUserName          = $machineUserName"
    Write-Host "runAsProcess             = $runAsProcess"
    Write-Host "logonAutomatically       = $logonAutomatically"
    Write-Host "disableScreenSaver       = $disableScreenSaver"
    Write-Host "isDataCollectionOnly     = $isDataCollectionOnly"
    Write-Host "testPlatform             = $testPlatform"
    Write-Host "agentLocation            = $agentLocation"
    Write-Host "updateTestAgent          = $updateTestAgent"
    Write-Host "****************************************************************"

    $downloadTestAgentScript            = "$PSScriptRoot\DownloadTestAgent.ps1"
    $setupTestMachineForUITestsScript   = "$PSScriptRoot\SetupTestMachineForUITests.ps1"
    $TestAgentConfigurationScript       = "$PSScriptRoot\TestAgentConfiguration.ps1"
    $testAgentHelperScript              = "$PSScriptRoot\TestAgentHelper.ps1"
    $installTestAgentScript             = "$PSScriptRoot\InstallTestAgent.ps1"
    $verifyTestAgentInstalledScript     = "$PSScriptRoot\VerifyTestAgentInstalled.ps1"

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

    # Import the Task.Internal dll that has all the cmdlets we need for Build
    Import-Module "$PSScriptRoot\modules\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.dll"
    Import-Module "$PSScriptRoot\modules\MS.TF.Task.TestPlatform.Acquisition.dll"
    
    Write-Verbose "Getting Access Token for the Run"
    $endpoint = Get-VstsEndpoint -Name SystemVssConnection -Require
    $personalAccessToken = [string]($endpoint.auth.parameters.AccessToken)

    if (!$personalAccessToken)
    {
        Write-Host "##vso[task.logissue type=error;code=Unable to generate Personal Access Token for the user;TaskName=DTA]"
        throw (Get-LocalizedString -Key "Unable to generate Personal Access Token for the user. Contact Project Collection Administrator")
    }

    try
    {
        Write-Verbose "Completed Register-Environment" -Verbose
        $environment = Register-Environment -EnvironmentName $testMachines -EnvironmentSpecification $testMachines -WinRmProtocol $winRmProtocol -TestCertificate ($testCertificate -eq "true") -UserName $adminUserName -Password $adminPassword
        Write-Verbose "Completed Register-Environment" -Verbose

        $deployParams = New-Object 'System.Collections.Generic.Dictionary[String,Object]'
        $deployParams.Add("environmentname", $testMachines)
        $deployParams.Add("environment", $environment)
        $deployParams.Add("username", $machineUserName)
        $deployParams.Add("password", $machinePassword)
        $deployParams.Add("personalaccesstoken", $personalAccessToken)
        $deployParams.Add("disablescreensaver", $disableScreenSaver)
        $deployParams.Add("logonautomatically", $logonAutomatically)
        $deployParams.Add("runasprocess", $runAsProcess)
        $deployParams.Add("installagentscriptlocation", $installTestAgentScript)
        $deployParams.Add("testagentconfigurationscriptlocation", $TestAgentConfigurationScript)
        $deployParams.Add("verifytestagentinstalledscriptlocation", $verifyTestAgentInstalledScript)
        $deployParams.Add("downloadtestagentscriptlocation", $downloadTestAgentScript)
        $deployParams.Add("testagenthelperscriptlocation", $testAgentHelperScript)
        $deployParams.Add("setuptestmachineforuitestsscriptlocation", $setupTestMachineForUITestsScript)
        $deployParams.Add("testplatformversion", $testPlatform)
        $deployParams.Add("agentlocation", $agentLocation)
        $deployParams.Add("updatetestagent", $updateTestAgent)
        $deployParams.Add("datacollectiononly", $isDataCollectionOnly)
        
        $deployTestPlatform = New-Object 'MS.TF.Task.TestPlatform.Acquisition.DeployTestAgent'
        $deployTestPlatform.Start($deployParams)
    }
    catch
    {
        Write-Host "##vso[task.complete result=Failed;]$_"
    }

} finally {
    Trace-VstsLeavingInvocation $MyInvocation
} 