$rollForwardTable = @{
    "5.0.0" = "5.1.1";
};

function Get-SavedModuleContainerPath {
    return $env:SystemDrive + "\Modules";
}

function Get-SavedModulePath {
    [CmdletBinding()]
    param([string] $azurePowerShellVersion,
          [switch] $Classic)
    
    if($Classic -eq $true) {
        return (Get-SavedModuleContainerPath) + "\Azure_" + $azurePowerShellVersion;
    }
    else {
        return (Get-SavedModuleContainerPath) + "\AzureRm_" + $azurePowerShellVersion;
    }
}

function Update-PSModulePathForHostedAgent {
    [CmdletBinding()]
    param([string] $targetAzurePs,
          [string] $authScheme)
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        if ($targetAzurePs) {
            $hostedAgentAzureRmModulePath = Get-SavedModulePath -azurePowerShellVersion $targetAzurePs
            $hostedAgentAzureModulePath = Get-SavedModulePath -azurePowerShellVersion $targetAzurePs -Classic
        }
        else {
            $hostedAgentAzureRmModulePath = Get-LatestModule -patternToMatch "^azurerm_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$" -moduleName:'AzureRM'
            $hostedAgentAzureModulePath  =  Get-LatestModule -patternToMatch "^azure_[0-9]+\.[0-9]+\.[0-9]+$"   -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$" -moduleName:'Azure'
        }

        if ($authScheme -eq 'ServicePrincipal' -or $authScheme -eq 'ManagedServiceIdentity' -or $authScheme -eq '') {
            $env:PSModulePath = $hostedAgentAzureModulePath + ";" + $env:PSModulePath
            $env:PSModulePath = $env:PSModulePath.TrimStart(';')
            $env:PSModulePath = $hostedAgentAzureRmModulePath + ";" + $env:PSModulePath
            $env:PSModulePath = $env:PSModulePath.TrimStart(';')
        }
        elseif ($authScheme -eq 'WorkloadIdentityFederation') {
            if ($targetAzurePs) {
                $hostedAgentAzureAzModulePath = (Get-SavedModuleContainerPath) + "\az_" + $targetAzurePs
            }
            else {
                $hostedAgentAzureAzModulePath = Get-LatestModule -patternToMatch "^az_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$" -moduleName:'Az'
            }
            $env:PSModulePath = $hostedAgentAzureAzModulePath + ";" + $env:PSModulePath
            $env:PSModulePath = $env:PSModulePath.TrimStart(';')
        }
        else {
            $env:PSModulePath = $hostedAgentAzureRmModulePath + ";" + $env:PSModulePath
            $env:PSModulePath = $env:PSModulePath.TrimStart(';')
            $env:PSModulePath = $hostedAgentAzureModulePath + ";" + $env:PSModulePath
            $env:PSModulePath = $env:PSModulePath.TrimStart(';')
        }

    } finally {
        Write-Verbose "The updated value of the PSModulePath is: $($env:PSModulePath)"
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-LatestModule {
    [CmdletBinding()]
    param([string] $patternToMatch,
          [string] $patternToExtract,
          [string] $moduleName)

    $resultFolder = ""
    $regexToMatch = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToMatch
    $regexToExtract = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToExtract
    $maxVersion = [version] "0.0.0"

    try {
        $moduleFolders = Get-ChildItem -Directory -Path $($env:SystemDrive + "\Modules") | Where-Object { $regexToMatch.IsMatch($_.Name) }
        foreach ($moduleFolder in $moduleFolders) {
            $moduleVersion = [version] $($regexToExtract.Match($moduleFolder.Name).Groups[0].Value)
            if($moduleVersion -gt $maxVersion) {
                $modulePath = [System.IO.Path]::Combine($moduleFolder.FullName,"$moduleName\$moduleVersion\$moduleName.psm1")

                if(Test-Path -LiteralPath $modulePath -PathType Leaf) {
                    $maxVersion = $moduleVersion
                    $resultFolder = $moduleFolder.FullName
                } else {
                    Write-Verbose "A folder matching the module folder pattern was found at $($moduleFolder.FullName) but didn't contain a valid module file"
                }
            }
        }
    }
    catch {
        Write-Verbose "Attempting to find the Latest Module Folder failed with the error: $($_.Exception.Message)"
        $resultFolder = ""
    }
    Write-Verbose "Latest module folder detected: $resultFolder"
    return $resultFolder
}

function  Get-RollForwardVersion {
    [CmdletBinding()]
    param([string]$azurePowerShellVersion)
    Trace-VstsEnteringInvocation $MyInvocation
    
    try {
        $rollForwardAzurePSVersion = $rollForwardTable[$azurePowerShellVersion]
        if(![string]::IsNullOrEmpty($rollForwardAzurePSVersion)) {
            $hostedAgentAzureRmModulePath = Get-SavedModulePath -azurePowerShellVersion $rollForwardAzurePSVersion
            $hostedAgentAzureModulePath = Get-SavedModulePath -azurePowerShellVersion $rollForwardAzurePSVersion -Classic
        
            if((Test-Path -Path $hostedAgentAzureRmModulePath) -eq $true -or (Test-Path -Path $hostedAgentAzureModulePath) -eq $true) {
                Write-Warning (Get-VstsLocString -Key "OverrideAzurePowerShellVersion" -ArgumentList $azurePowerShellVersion, $rollForwardAzurePSVersion)
                return $rollForwardAzurePSVersion;
            }
        }
        return $azurePowerShellVersion
    }
    finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}