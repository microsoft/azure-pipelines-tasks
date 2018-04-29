function Get-TargetMachines {
    [CmdletBinding()]
    Param (
        [string[]] $targetMachineNames,
        [pscredential] $credential,
        [string] $authentication,
        [string] $sessionConfigurationName,
        [switch] $useSsl
    )
    Trace-VstsEnteringInvocation -InvocationInfo $MyInvocation -Parameter ''
    try {
        Write-Verbose "Target Machines: $($targetMachineNames -join ',')"
        $targetMachines = @();
        foreach($targetMachineName in $targetMachineNames) {
            $targetMachine = @{
                ComputerName = "";
                WSManPort = "";
                Credential = $credential;
                Authentication = $authentication;
                SessionConfigurationName = $sessionConfigurationName;
                UseSsl = $useSsl
            }
        
            $computerName, $port = $targetMachineName.Split(':');
            if([string]::IsNullOrEmpty($port)) {
                if($useSsl) {
                    $port = "5986"
                } else {
                    $port = "5985"
                }
            }
            $targetMachine.ComputerName = $computerName
            $targetMachine.WSManPort = $port

            Write-Verbose "ComputerName = $($targetMachine.ComputerName)"
            Write-Verbose "WSManPort = $($targetMachine.WSManPort)"
            Write-Verbose "Authentication = $($targetMachine.Authentication)"
            Write-Verbose "SessionConfigurationName = $($targetMachine.SessionConfigurationName)"
            Write-Verbose "UseSSL = $($targetMachine.UseSsl)"
            $targetMachines += $targetMachine
        }
        Write-Verbose "Total target machines are: $($targetMachines.Count)"
        return $targetMachines
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

$defaultErrorHandler = {
    Param($object, $computerName)
    Write-Host ($object | Out-String)
}

$defaultOutputHandler = {
    Param($object, $computerName)
    Write-Host ($object | Out-String)
}