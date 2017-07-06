function Update-PSModulePath {
    [CmdletBinding()]
    param([string] $targetAzurePs)

    $pattern = "^[0-9]+\.[0-9]+\.[0-9]+$"
    $regex = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $pattern

    if ($regex.IsMatch($targetAzurePs)) {
        $hostedAgentAzureRmModulePath = $env:SystemDrive + "\Modules\AzureRm_" + $targetAzurePs
        $hostedAgentAzureModulePath = $env:SystemDrive + "\Modules\Azure_" + $targetAzurePs
    }
    elseif ($targetAzurePs -eq "LatestVersion") {
        # For Hosted Agent, the Latest Version is 4.1.0
        $hostedAgentAzureRmModulePath = Get-LatestModule -patternToMatch "^azurerm_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
        $hostedAgentAzureModulePath  =  Get-LatestModule -patternToMatch "^azure_[0-9]+\.[0-9]+\.[0-9]+$"   -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
        $targetAzurePs = ""
    }
    else {
        throw (Get-VstsLocString -Key InvalidVersion -ArgumentList $targetAzurePs)
    }
    $env:PSModulePath = $hostedAgentAzureRmModulePath + ";" + $hostedAgentAzureModulePath + ";" + $env:PSModulePath
    $env:PSModulePath.TrimStart(';')
    return $targetAzurePs
}

function Get-LatestModule {
    [CmdletBinding()]
    param([string] $patternToMatch,
          [string] $patternToExtract)
    
    $resultFolder = ""
    try {
        $regexToMatch = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToMatch
        $regexToExtract = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToExtract
        $moduleFolders = Get-ChildItem -Directory -Path [Sytem.IO.Path]::Combine($env:SystemDrive,"Modules") | Where-Object { $regexToMatch.IsMatch($_.Name) }

        $maxVersion = [version] "0.0.0"
        foreach ($moduleFolder in $moduleFolders) 
        {
            $moduleVersion = [version] $($regexToExtract.Match($moduleFolder.Name).Groups[0].Value)
            if($moduleVersion -gt $maxVersion)
            {
                $maxVersion = $moduleVersion
                $resultFolder = $moduleFolder.FullName
            }
        }
    }
    catch {
        Write-Verbose "Attempting to find the Latest Module Folder failed with the error: $($_.Exception.Message)"
        $resultFolder = ""
    }
    return $resultFolder
}
