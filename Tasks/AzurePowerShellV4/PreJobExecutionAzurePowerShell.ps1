. "$PSScriptRoot/PreJobExecutionUtility.ps1"

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