$azureRMModulePath = "C:\Modules\azurerm_2.1.0"
$azureModulePath = "C:\Modules\azure_2.1.0"

if ($env:PSModulePath.split(";") -contains $azureRMModulePath) {
    $env:PSModulePath = (($env:PSModulePath).Split(";") | ? { $_ -ne $azureRMModulePath }) -join ";"
    write-verbose "$azureRMModulePath removed. Restart the prompt for the changes to take effect."
}
else {
    write-verbose "$azureRMModulePath is not present in $env:psModulePath"
}

if ($env:PSModulePath.split(";") -contains $azureModulePath) {
    $env:PSModulePath = (($env:PSModulePath).Split(";") | ? { $_ -ne $azureModulePath }) -join ";"
    write-verbose "$azureModulePath removed. Restart the prompt for the changes to take effect."
}
else {
    write-verbose "$azureModulePath is not present in $env:psModulePath"
}

Set-VstsTaskVariable -Name 'AZ_PS_MODULE_PATH' -Value $env:PSModulePath