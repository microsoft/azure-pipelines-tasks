$azureRMModulePath = "C:\Modules\azurerm_2.1.0"
$azureModulePath = "C:\Modules\azure_2.1.0"
$azPSModulePath = $env:PSModulePath

if ($azPSModulePath.split(";") -contains $azureRMModulePath) {
    $azPSModulePath = (($azPSModulePath).Split(";") | ? { $_ -ne $azureRMModulePath }) -join ";"
    write-verbose "$azureRMModulePath removed. Restart the prompt for the changes to take effect."
}
else {
    write-verbose "$azureRMModulePath is not present in $azPSModulePath"
}

if ($azPSModulePath.split(";") -contains $azureModulePath) {
    $azPSModulePath = (($azPSModulePath).Split(";") | ? { $_ -ne $azureModulePath }) -join ";"
    write-verbose "$azureModulePath removed. Restart the prompt for the changes to take effect."
}
else {
    write-verbose "$azureModulePath is not present in $azPSModulePath"
}

Set-VstsTaskVariable -Name 'AZ_PS_MODULE_PATH' -Value $azPSModulePath