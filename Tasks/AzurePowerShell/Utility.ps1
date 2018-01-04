function Update-PSModulePathForHostedAgent {
    [CmdletBinding()]
    param([string] $targetAzurePs)
    Trace-VstsEnteringInvocation $MyInvocation
    try {
        if ($targetAzurePs) {
            $hostedAgentAzureRmModulePath = $env:SystemDrive + "\Modules\AzureRm_" + $targetAzurePs
            $hostedAgentAzureModulePath = $env:SystemDrive + "\Modules\Azure_" + $targetAzurePs
        }
        else {
            $hostedAgentAzureRmModulePath = Get-LatestModule -patternToMatch "^azurerm_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$" -Classic:$false
            $hostedAgentAzureModulePath  =  Get-LatestModule -patternToMatch "^azure_[0-9]+\.[0-9]+\.[0-9]+$"   -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$" -Classic:$true
        }
        $env:PSModulePath = $hostedAgentAzureRmModulePath + ";" + $env:PSModulePath
        $env:PSModulePath = $env:PSModulePath.TrimStart(';')
        $env:PSModulePath = $hostedAgentAzureModulePath + ";" + $env:PSModulePath
        $env:PSModulePath = $env:PSModulePath.TrimStart(';')
    } finally {
        Write-Verbose "The updated value of the PSModulePath is: $($env:PSModulePath)"
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-LatestModule {
    [CmdletBinding()]
    param([string] $patternToMatch,
          [string] $patternToExtract,
          [switch] $Classic)
    
    $resultFolder = ""
    $regexToMatch = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToMatch
    $regexToExtract = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToExtract
    $maxVersion = [version] "0.0.0"

    try {
        $moduleFolders = Get-ChildItem -Directory -Path $($env:SystemDrive + "\Modules") | Where-Object { $regexToMatch.IsMatch($_.Name) }
        foreach ($moduleFolder in $moduleFolders) {
            $moduleVersion = [version] $($regexToExtract.Match($moduleFolder.Name).Groups[0].Value)
            if($moduleVersion -gt $maxVersion) {
                if($Classic) {
                    $modulePath = [System.IO.Path]::Combine($moduleFolder.FullName,"Azure\$moduleVersion\Azure.psm1")
                } else {
                    $modulePath = [System.IO.Path]::Combine($moduleFolder.FullName,"AzureRM\$moduleVersion\AzureRM.psm1")
                }

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