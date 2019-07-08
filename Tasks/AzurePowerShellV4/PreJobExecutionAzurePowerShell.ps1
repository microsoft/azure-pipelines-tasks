$targetAzurePs = Get-VstsInput -Name TargetAzurePs
$customTargetAzurePs = Get-VstsInput -Name CustomTargetAzurePs

# string constants
$otherVersion = "OtherVersion"
$latestVersion = "LatestVersion"

if ($targetAzurePs -eq $otherVersion) {
    if ($customTargetAzurePs -eq $null) {
        throw (Get-VstsLocString -Key InvalidAzurePsVersion $customTargetAzurePs)
    } else {
        $targetAzurePs = $customTargetAzurePs.Trim()        
    }
}

$pattern = "^[0-9]+\.[0-9]+\.[0-9]+$"
$regex = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $pattern

if ($targetAzurePs -eq $latestVersion) {
    $targetAzurePs = ""
} elseif (-not($regex.IsMatch($targetAzurePs))) {
    throw (Get-VstsLocString -Key InvalidAzurePsVersion -ArgumentList $targetAzurePs)
}

function Get-SavedModulePath {
    [CmdletBinding()]
    param([string] $azurePowerShellVersion)
    $savedModulePath = $($env:SystemDrive + "\Modules\az_" + $azurePowerShellVersion)
    Write-Verbose "The value of the module path is: $savedModulePath"
    return $savedModulePath 
}

function Get-LatestModule {
    [CmdletBinding()]
    param([string] $patternToMatch,
          [string] $patternToExtract)
    
    $resultFolder = ""
    $regexToMatch = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToMatch
    $regexToExtract = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $patternToExtract
    $maxVersion = [version] "0.0.0"

    try {
        $moduleFolders = Get-ChildItem -Directory -Path $($env:SystemDrive + "\Modules") | Where-Object { $regexToMatch.IsMatch($_.Name) }
        foreach ($moduleFolder in $moduleFolders) {
            $moduleVersion = [version] $($regexToExtract.Match($moduleFolder.Name).Groups[0].Value)
            if($moduleVersion -gt $maxVersion) {
                $modulePath = [System.IO.Path]::Combine($moduleFolder.FullName,"Az\$moduleVersion\Az.psm1")

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

try {
    if ($targetAzurePs) {
        $hostedAgentAzModulePath = Get-SavedModulePath -azurePowerShellVersion $targetAzurePs
    }
    else {
        $hostedAgentAzModulePath = Get-LatestModule -patternToMatch "^az_[0-9]+\.[0-9]+\.[0-9]+$" -patternToExtract "[0-9]+\.[0-9]+\.[0-9]+$"
    }

    $env:PSModulePath = $hostedAgentAzModulePath + ";" + $env:PSModulePath
    $env:PSModulePath = $env:PSModulePath.TrimStart(';') 
} finally {
    Write-Verbose "The updated value of the PSModulePath is: $($env:PSModulePath)"
    Trace-VstsLeavingInvocation $MyInvocation
}

$azureRMModulePath = "C:\Modules\azurerm_2.1.0"
$azureModulePath = "C:\Modules\azure_2.1.0"

if ($env:PSModulePath.split(";") -contains $azureRMModulePath) {
    $NewValue = (($env:PSModulePath).Split(";") | ? { $_ -ne $azureRMModulePath }) -join ";"
    [Environment]::SetEnvironmentVariable("PSModulePath", $NewValue, "Machine")
    $env:PSModulePath = [System.Environment]::GetEnvironmentVariable("PSModulePath","Machine")
    write-verbose "$azureRMModulePath removed. Restart the prompt for the changes to take effect."
}
else {
    write-verbose "$azureRMModulePath is not present in $env:psModulePath"
}

if ($env:PSModulePath.split(";") -contains $azureModulePath) {
    $NewValue = (($env:PSModulePath).Split(";") | ? { $_ -ne $azureModulePath }) -join ";"
    [Environment]::SetEnvironmentVariable("PSModulePath", $NewValue, "Machine")
    $env:PSModulePath = [System.Environment]::GetEnvironmentVariable("PSModulePath","Machine")
    write-verbose "$azureModulePath removed. Restart the prompt for the changes to take effect."
}
else {
    write-verbose "$azureModulePath is not present in $env:psModulePath"
}

Set-VstsTaskVariable -Name 'AZ_PS_MODULE_PATH' -Value $env:PSModulePath