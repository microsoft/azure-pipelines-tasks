function Parse-TargetMachineNames {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string] $machineNames)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        $targetMachineNames = $machinesNames.Split(',') | Where-Object { if (![string]::IsNullOrEmpty($_)) { $_ } } | ForEach-Object { Write-Verbose "TargetMachineName: '$_'" ; $_ };
        return $targetMachineNames;
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-TargetMachineCredential {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string] $userName,
        [Parameter(Mandatory = $true)]
        [securestring] $securePassword,
        [Parameter(Mandatory = $true)]
        [ValidateCount(2,2)]
        [string[]] $variableNames
    )
    
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        return New-Object System.Management.Automation.PSCredential($userName, $securePassword)
    } finally {
        ForEach ($variableName in $variableNames) {
            Remove-Variable -Name $variableName -Force -Scope Script -ErrorAction SilentlyContinue
        }
        Trace-VstsLeavingInvocation $MyInvocation
    }
}