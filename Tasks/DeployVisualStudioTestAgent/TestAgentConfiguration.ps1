function ConfigureTestAgent
{
    param
    (
        [String] $SetupPath,
        [String] $TestUserName,
        [String] $TestUserPassword,
        [String] $TfsCollection,
        [String] $TestAgentVersion = "14.0",
        [String] $EnvironmentUrl,
        [String] $PersonalAccessToken,
        [ValidateSet("Service", "Process")]
        [String] $AsServiceOrProcess,
        [String[]] $Capabilities
    )

    Try {
        # Fix Assembly Redirections
        # VSTS uses Newton Json 8.0 while the System.Net.Http uses 6.0
        # Redirection to Newton Json 8.0
        $path = "$SetupPath\TfsAssemblies\Newtonsoft.Json.dll"
        Write-Verbose "Path: $path"

        $jsonAssembly = [reflection.assembly]::LoadFrom($path) 
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

        Import-Module "$SetupPath\TfsAssemblies\Newtonsoft.Json.dll"
        Import-Module "$SetupPath\TfsAssemblies\System.Net.Http.Formatting.dll"
        Import-Module "$SetupPath\TfsAssemblies\Microsoft.TeamFoundation.DistributedTask.Task.TestExecution.dll"
        Import-Module "$SetupPath\TfsAssemblies\Microsoft.TeamFoundation.Common.dll"
        Import-Module "$SetupPath\TfsAssemblies\Microsoft.TeamFoundation.Test.WebApi.dll"
        Import-Module "$SetupPath\TfsAssemblies\Microsoft.VisualStudio.Services.Common.dll"
        Import-Module "$SetupPath\TfsAssemblies\Microsoft.VisualStudio.Services.WebApi.dll"
        Import-Module "$SetupPath\PrivateAssemblies\MS.VS.TestService.Client.Utility.dll"

        $MachineName = $Env:COMPUTERNAME

        Write-Verbose "****************************************************************"
        Write-Verbose "                    Configure Test Agent                      "
        Write-Verbose "----------------------------------------------------------------"
        Write-Verbose "SetupPath                       : ($SetupPath)"
        Write-Verbose "TestUserName                    : ($TestUserName)"
        Write-Verbose "TfsCollection                   : ($TfsCollection)"
        Write-Verbose "AsServiceOrProcess              : ($AsServiceOrProcess)"
        Write-Verbose "EnvironmentUrl                  : ($EnvironmentUrl)"
        Write-Verbose "MachineName                     : ($MachineName)"
        Write-Verbose "Capabilities                    : ($Capabilities)"
        Write-Verbose "TestAgentVersion                : ($TestAgentVersion)"
        Write-Verbose "****************************************************************"
        
        $DtaAgentClient = New-Object MS.VS.TestService.Client.Utility.TestExecutionServiceRestApiHelper -ArgumentList $TfsCollection, $PersonalAccessToken

        if(-not $DtaAgentClient){
            throw "Unable to register the agent with Team Foundation Server"
        }

        $DtaAgent = $DtaAgentClient.Register($MachineName, $EnvironmentUrl, $MachineName, $Capabilities)
        Write-Verbose "Register the Agent with Id: $($DtaAgent.Id)"

        $DtaProcess = New-Object System.Diagnostics.Process
        $Processinfo = New-Object System.Diagnostics.ProcessStartInfo
        $Processinfo.EnvironmentVariables.Add("DTA.AccessToken", $PersonalAccessToken);
        $Processinfo.EnvironmentVariables.Add("DTA.AgentId", $DtaAgent.Id);
        $Processinfo.EnvironmentVariables.Add("DTA.EnvironmentUri", $EnvironmentUrl);
        $Processinfo.EnvironmentVariables.Add("DTA.TeamFoundationCollectionUri", $TfsCollection);
        $Processinfo.EnvironmentVariables.Add("DTA.TestPlatfromVersion", $TestAgentVersion);

        if ($AsServiceOrProcess -eq "Service")
        {
            $Processinfo.UseShellExecute = $false
            $Processinfo.LoadUserProfile = $false
            $Processinfo.CreateNoWindow = $true
            $Processinfo.RedirectStandardError = $true
            $Processinfo.RedirectStandardOutput = $true
            $Processinfo.WindowStyle = "Hidden"
            $Processinfo.FileName = "$SetupPath\DTAExecutionHost.exe"
            $Processinfo.WorkingDirectory = "$SetupPath"
        }
        else
        {
            $Processinfo.UseShellExecute = $false
            $Processinfo.LoadUserProfile = $false
            $Processinfo.RedirectStandardError = $true
            $Processinfo.RedirectStandardOutput = $true
            $Processinfo.WindowStyle = "Normal"
            $Processinfo.FileName = "$SetupPath\DTAExecutionHost.exe"
            $Processinfo.WorkingDirectory = "$SetupPath"
        }

        $DtaProcess.StartInfo = $Processinfo
    
    
        if($DtaProcess.Start()){
            Write-Verbose "DTAExecutionHost Process Id: $($DtaProcess.Id)"
            return $($DtaProcess.Id)
        }
        
        throw "Unable to start DTAExecutionHost process"
    }
    Catch {
        Write-Error $_
        throw
    }
}

return ConfigureTestAgent -SetupPath $SetupPath -TestUserName $testUserName -TestUserPassword $testUserPassword -TfsCollection $tfsCollection -TestAgentVersion $testAgentVersion -EnvironmentUrl $environmentUrl -PersonalAccessToken $personalAccessToken -AsServiceOrProcess $asServiceOrProcess -Capabilities @($capabilities)