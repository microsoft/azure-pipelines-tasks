$azureRMModulePath = "C:\Modules\azurerm_2.1.0"
$azureModulePath = "C:\Modules\azure_2.1.0"

if ($env:PSModulePath.split(";") -contains $azureRMModulePath) {
    $NewValue = (($env:PSModulePath).Split(";") | ? { $_ -ne $azureRMModulePath }) -join ";"
    $env:PSModulePath = $NewValue
    write-verbose "$azureRMModulePath removed. Restart the prompt for the changes to take effect."
}
else {
    write-verbose "$azureRMModulePath is not present in $env:psModulePath"
}

if ($env:PSModulePath.split(";") -contains $azureModulePath) {
    $NewValue = (($env:PSModulePath).Split(";") | ? { $_ -ne $azureModulePath }) -join ";"
    $env:PSModulePath = $NewValue
    write-verbose "$azureModulePath removed. Restart the prompt for the changes to take effect."
}
else {
    write-verbose "$azureModulePath is not present in $env:psModulePath"
}

write-verbose "The value of the PSModulePath is: $($env:PSModulePath)"
Set-VstsTaskVariable -Name 'AZ_PS_MODULE_PATH' -Value $env:PSModulePath