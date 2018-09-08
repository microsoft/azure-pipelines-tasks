function ConfigureTestAgent {
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

        $Domain = "."
        $TestUser = ""
        $DomainUser = $TestUserName.Split("\")
        if ($DomainUser.Length -gt 1) {
            $Domain = $DomainUser[0]
            $TestUser = $DomainUser[1]
        }
        else {
            $TestUser = $TestUserName
        }
        if ($Domain -eq ".") {
            $Domain = $Env:COMPUTERNAME
        }

        Write-Verbose -Message "Test User $TestUser" -Verbose
        Write-Verbose -Message "Test UserDomain $Domain" -Verbose

        # First look for DTA Archive. If not present quit
        if (-not (Test-Path "$SetupPath\TestExecution.zip")) {
            throw "Unable to locate Test Execution archive"
        }

        # Stop any existing process otherwise Archive extraction fails
        Try {
            Stop-Process -Name "DTAExecutionHost" -ErrorAction SilentlyContinue

            Add-Type -AssemblyName System.IO.Compression.FileSystem
            function Unzip {
                param([string]$zipfile, [string]$outpath)
                [System.IO.Compression.ZipFile]::ExtractToDirectory($zipfile, $outpath)
            }
            Unzip "$SetupPath\TestExecution.zip" $SetupPath
        }
        Catch {
            Write-Warning $_
        }

        $TestWindowPath = $null
        $VsPath = $null
        if ($TestAgentVersion -eq "15.0") {
            $instance = Get-VisualStudio_15_0
            if ($instance) {
                $VsPath = [System.IO.Path]::Combine($instance.Path, "Common7", "IDE")
                $TestWindowPath = [System.IO.Path]::Combine($VsPath, "CommonExtensions", "Microsoft", "TestWindow")
                Write-Verbose "VS path $VsPath; Test window path $TestWindowPath" -Verbose
            }
        }

        # Fix Assembly Redirections
        # VSTS uses Newton Json 8.0 while the System.Net.Http uses 6.0
        # Redirection to Newton Json 8.0
        $path = "$SetupPath\TfsAssemblies\Newtonsoft.Json.dll"
        Write-Verbose "Path: $path"

        $jsonAssembly = [reflection.assembly]::LoadFrom($path)
        $onAssemblyResolve = [System.ResolveEventHandler] {
            param($sender, $e)
            if ($e.Name -eq "Newtonsoft.Json, Version=6.0.0.0, Culture=neutral, PublicKeyToken=30ad4fe6b2a6aeed") { return $jsonAssembly }
            foreach ($a in [System.AppDomain]::CurrentDomain.GetAssemblies()) {
                if ($a.FullName -eq $e.Name) { return $a } else { return $null }
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
        Import-Module "$SetupPath\PrivateAssemblies\Microsoft.VisualStudio.TestService.Utility.dll"

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

        Try {
            $DtaAgentClient = New-Object Microsoft.VisualStudio.TestService.Utility.TestExecutionServiceRestApiHelper -ArgumentList $TfsCollection, $PersonalAccessToken
        }
        Catch {
            Write-Verbose "Unable to connect to Team Foundation Server, Check if TFS is reachable from the test agent. Exception Details : "
            Write-Verbose $_.Exception | format-list -force
            throw "Unable to connect to Team Foundation Server"
        }

        if (-not $DtaAgentClient) {
            throw "Unable to register the agent with Team Foundation Server"
        }

        $DtaAgent = $DtaAgentClient.Register($MachineName, $EnvironmentUrl, $MachineName, $Capabilities)
        Write-Verbose "Register the Agent with Id: $($DtaAgent.Id)"

        # For all our sake, DON'T ever remove this line. It took literally 6 hours to figure out why this is needed.
        # ​¯\_(ツ)_/¯
        [System.AppDomain]::CurrentDomain.remove_AssemblyResolve($onAssemblyResolve)

        # Running tests under different user account under service mode is not possible. one should always enable "Run UI tests" scenario
        if ($AsServiceOrProcess -eq "Service") {
            $DtaProcess = New-Object System.Diagnostics.Process
            $Processinfo = New-Object System.Diagnostics.ProcessStartInfo
            $Processinfo.EnvironmentVariables.Add("DTA.AccessToken", $PersonalAccessToken);
            $Processinfo.EnvironmentVariables.Add("DTA.AgentId", $DtaAgent.Id);
            $Processinfo.EnvironmentVariables.Add("DTA.EnvironmentUri", $EnvironmentUrl);
            $Processinfo.EnvironmentVariables.Add("DTA.TeamFoundationCollectionUri", $TfsCollection);
            $Processinfo.EnvironmentVariables.Add("DTA.TestPlatformVersion", $TestAgentVersion);
            if ($VsPath) {
                $Processinfo.EnvironmentVariables.Add("DTA.VisualStudio.Path", $VsPath);
                $Processinfo.EnvironmentVariables.Add("DTA.TestWindow.Path", $TestWindowPath);
            }
            $Processinfo.UseShellExecute = $false
            $Processinfo.LoadUserProfile = $false
            $Processinfo.CreateNoWindow = $true
            $Processinfo.RedirectStandardError = $true
            $Processinfo.RedirectStandardOutput = $true
            $Processinfo.WindowStyle = "Hidden"
            $Processinfo.FileName = "$SetupPath\DTAExecutionHost.exe"
            $Processinfo.WorkingDirectory = "$SetupPath"

            $DtaProcess.StartInfo = $Processinfo
            if ($DtaProcess.Start()) {
                Write-Verbose "DTAExecutionHost Process Id: $($DtaProcess.Id)"
                Start-Sleep -Seconds 60 # required to keep service active till process loads Assembly_Resolve
                return 0
            }

            throw "Unable to start DTAExecutionHost process"
        }
        else {
            $dtaArgs = "DTA.AccessToken:$PersonalAccessToken DTA.AgentId:$($DtaAgent.Id) DTA.EnvironmentUri:$EnvironmentUrl DTA.TeamFoundationCollectionUri:$TfsCollection DTA.TestPlatformVersion:$TestAgentVersion"

            $osVersion = [environment]::OSVersion.Version
            if ($osVersion.Major -lt "6" -or ($osVersion.Major -eq "6" -and $osVersion.Minor -lt "1")) {
                throw "Unsupported Windows operating system"
            }

            if ($osVersion.Major -eq "6" -and $osVersion.Minor -eq "1") {
                ## Windows 7 SP1
                $ScheduleObject = New-Object -ComObject Schedule.Service
                $ScheduleObject.Connect()

                $TaskDefinition = $ScheduleObject.NewTask(0)
                $TaskDefinition.RegistrationInfo.Description = "DTA UI"
                $TaskDefinition.Settings.Enabled = $true
                $TaskDefinition.Settings.AllowDemandStart = $true
                $TaskDefinition.Settings.DisallowStartIfOnBatteries = $true
                $TaskDefinition.Settings.StartWhenAvailable = $true
                $TaskDefinition.Principal.UserId = "$Domain\$TestUser"
                $taskDefinition.Principal.LogonType = 3  # Run in Interactive session. User must be logged in

                $triggers = $TaskDefinition.Triggers
                $trigger = $triggers.Create(7) # Start task immediatly after creating/updating
                $trigger.ExecutionTimeLimit = 'PT0S' # No time limit

                $action = $TaskDefinition.Actions.Create(0)
                $action.Path = "$SetupPath\DTAExecutionHost.exe"
                $action.Arguments = $dtaArgs

                $rootFolder = $ScheduleObject.GetFolder('\') #'
                $newTask = $rootFolder.RegisterTaskDefinition("DTA", $TaskDefinition, 6, '', '', 3)
                Write-Verbose "Starting scheduled task on Windows 7." -Verbose
                Start-Sleep -Seconds 30
                $p = Get-Process -Name "DTAExecutionHost"
                $rootFolder.DeleteTask("DTA", 0)
            }
            else {
                # Windows 8 or above
                $action = New-ScheduledTaskAction -Execute "$SetupPath\DTAExecutionHost.exe" -Argument $dtaArgs
                $trigger = New-ScheduledTaskTrigger -AtLogOn
                $principal = New-ScheduledTaskPrincipal -UserId "$Domain\$TestUser" -LogonType Interactive

                Unregister-ScheduledTask -TaskName "DTA" -Confirm:$false -OutVariable out -ErrorVariable err -ErrorAction SilentlyContinue | Out-Null
                Register-ScheduledTask -Principal $principal -Action $action -Trigger $trigger -TaskName "DTA" -Description "DTA UI" -OutVariable out -ErrorVariable err | Out-Null
                Write-Verbose "Registering scheduled task output: $out error: $err" -Verbose

                Start-ScheduledTask -TaskName "DTA" -OutVariable out -ErrorVariable err | Out-Null
                Write-Verbose "Starting scheduled task output: $out error: $err" -Verbose

                Start-Sleep -Seconds 30
                $p = Get-Process -Name "DTAExecutionHost"
                Unregister-ScheduledTask  -TaskName "DTA" -Confirm:$false -ErrorAction SilentlyContinue
            }

            if ($p) {
                return 0
            }

            throw "Unable to start DTAExecutionHost process"
        }
    }
    Catch {
        Write-Error $_
        throw
    }
}

return ConfigureTestAgent -SetupPath $SetupPath -TestUserName $testUserName -TestUserPassword $testUserPassword -TfsCollection $tfsCollection -TestAgentVersion $testAgentVersion -EnvironmentUrl $environmentUrl -PersonalAccessToken $personalAccessToken -AsServiceOrProcess $asServiceOrProcess -Capabilities @($capabilities)
