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
    [string]$sessionVariables,
    [string]$scriptRoot
    )

    Import-Module�"$scriptRoot\DeploymentUtilities\Microsoft.TeamFoundation.DistributedTask.Task.Deployment.dll"

    Write-Verbose "fqdn = $fqdn"
    Write-Verbose "scriptPath = $scriptPath"
    Write-Verbose "port = $port"
    Write-Verbose "scriptArguments = $scriptArguments"
    Write-Verbose "initializationScriptPath = $initializationScriptPath"
    Write-Verbose "protocolOption = $httpProtocolOption"
    Write-Verbose "skipCACheckOption = $skipCACheckOption"
    Write-Verbose "enableDetailedLogging = $enableDetailedLogging"

    $enableDetailedLoggingOption = ''
    if ($enableDetailedLogging -eq "true")
    {
        $enableDetailedLoggingOption = '-EnableDetailedLogging'
    }

    $parsedSessionVariables = Get-ParsedSessionVariables -inputSessionVariables $sessionVariables
   
    Write-Verbose "Initiating deployment on $fqdn"
    [String]$psOnRemoteScriptBlockString = "Invoke-PsOnRemote -MachineDnsName $fqdn -ScriptPath `$scriptPath -WinRMPort $port -Credential `$credential -ScriptArguments `$scriptArguments -InitializationScriptPath `$initializationScriptPath -SessionVariables `$parsedSessionVariables $skipCACheckOption $httpProtocolOption $enableDetailedLoggingOption"
    [scriptblock]$psOnRemoteScriptBlock = [scriptblock]::Create($psOnRemoteScriptBlockString)
    # Capture and filter information stream (Write-Host) to strip ##vso[ commands from remote output
    $deploymentResponse = Invoke-Command -ScriptBlock $psOnRemoteScriptBlock 6>&1 | ForEach-Object {
        if ($_ -is [System.Management.Automation.InformationRecord]) {
            $msg = $_.MessageData
            if ($msg -is [System.Management.Automation.HostInformationMessage]) {
                $text = $msg.Message
            } else {
                $text = "$msg"
            }
            if ($text -notmatch '^\s*##vso\[') {
                Write-Host $text
            }
        } else {
            $_
        }
    }
    
    Write-Output $deploymentResponse
}
