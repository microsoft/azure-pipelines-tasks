$RunPowershellJob = {
param (
    [string]$fqdn, 
    [string]$scriptPath,
    [string]$port,
    [string]$scriptArguments,
    [string]$initializationScriptPath,
    [object]$credential,
    [string]$httpProtocolOption,
    [string]$skipCACheckOption,
    [string]$enableDetailedLogging,
    [string]$sessionVariables
    )

    Write-Verbose "fqdn = $fqdn"
    Write-Verbose "scriptPath = $scriptPath"
    Write-Verbose "port = $port"
    Write-Verbose "scriptArguments = $scriptArguments"
    Write-Verbose "initializationScriptPath = $initializationScriptPath"
    Write-Verbose "protocolOption = $httpProtocolOption"
    Write-Verbose "skipCACheckOption = $skipCACheckOption"
    Write-Verbose "enableDetailedLogging = $enableDetailedLogging"

    if(Test-Path "$env:AGENT_HOMEDIRECTORY\Agent\Worker")
    {
        Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\*.dll | % {
        [void][reflection.assembly]::LoadFrom( $_.FullName )
        Write-Verbose "Loading .NET assembly:`t$($_.name)"
        }

        Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\Modules\Microsoft.TeamFoundation.DistributedTask.Task.DevTestLabs\*.dll | % {
        [void][reflection.assembly]::LoadFrom( $_.FullName )
        Write-Verbose "Loading .NET assembly:`t$($_.name)"
        }
    }
    else
    {
        if(Test-Path "$env:AGENT_HOMEDIRECTORY\externals\vstshost")
        {
            [void][reflection.assembly]::LoadFrom("$env:AGENT_HOMEDIRECTORY\externals\vstshost\Microsoft.TeamFoundation.DistributedTask.Task.LegacySDK.dll")
        }
    }

    $enableDetailedLoggingOption = ''
    if ($enableDetailedLogging -eq "true")
    {
        $enableDetailedLoggingOption = '-EnableDetailedLogging'
    }

    $parsedSessionVariables = Get-ParsedSessionVariables -inputSessionVariables $sessionVariables
   
    Write-Verbose "Initiating deployment on $fqdn"
    [String]$psOnRemoteScriptBlockString = "Invoke-PsOnRemote -MachineDnsName $fqdn -ScriptPath `$scriptPath -WinRMPort $port -Credential `$credential -ScriptArguments `$scriptArguments -InitializationScriptPath `$initializationScriptPath -SessionVariables `$parsedSessionVariables $skipCACheckOption $httpProtocolOption $enableDetailedLoggingOption"
    [scriptblock]$psOnRemoteScriptBlock = [scriptblock]::Create($psOnRemoteScriptBlockString)
    $deploymentResponse = Invoke-Command -ScriptBlock $psOnRemoteScriptBlock
    
    # Telemetry data logic through ps session
    try{
        if($skipCACheckOption)
        {
            $sessionOption = New-PSSessionOption -SkipCACheck
        }
        else
        {
            $sessionOption = New-PSSessionOption 
        }
        $secpasswd = ConvertTo-SecureString  $credential.Password -AsPlainText -Force
        $psCredential =  New-Object System.Management.Automation.PSCredential($credential.UserName, $secpasswd)
        if($httpProtocolOption -eq '-UseHttp')
        {
            $session = New-PSSession -Computer $fqdn -Port $port -Credential $psCredential -SessionOption ($sessionOption )
        }
        else
        {
            $session = New-PSSession -Computer $fqdn -Port $port -Credential $psCredential -SessionOption ($sessionOption ) -UseSSL
        }
        $VmUuidHash  = Invoke-Command -Session  $session -ScriptBlock {
            $sha = New-Object System.Security.Cryptography.SHA512CryptoServiceProvider
            $computerDetails = Get-WmiObject -class Win32_ComputerSystemProduct -namespace root\CIMV2
            $encoding = [system.Text.Encoding]::ASCII
            $uuidHash = [System.BitConverter]::ToString( $sha.ComputeHash($encoding.GetBytes($computerDetails.UUID)))
            $uuidHash = $uuidHash  -replace  "-"  , ""
            return $uuidHash 
        }
        $isAzureVm = Invoke-Command -Session  $session -ScriptBlock {
            (Get-Process -Name 'WindowsAzureGuestAgent' -ErrorAction Ignore) | Select-Object -First 1 |  ForEach-Object {
                if($_.Path) 
                {
                    return $true
                } 
                else 
                { 
                    return $false
                } 
            }
        }
        $deploymentResponse | Add-Member "IsAzureVm" $IsAzureVm -Force
        $deploymentResponse | Add-Member "VmUuidHash" $VmUuidHash -Force   
    }
    catch
    {
        Write-Verbose "Error during fetching telemetry = $_"
        $deploymentResponse | Add-Member "TelemetryError" $_ -Force 
    }


    Write-Output $deploymentResponse
}
