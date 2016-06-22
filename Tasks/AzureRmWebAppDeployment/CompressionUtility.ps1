
function Substitute-ConfigurationParameters
{

    Param(

        [String][Parameter(mandatory=$true)]
        $PackageFile
    
    )

    Write-Verbose "Package file for parameters substitution : $PackageFile"

    # Getting packge file name so that can zip with same name 
    $PackageFileName = (Get-Item $PackageFile).Name

    # Getting installed location of 7zip.exe
    $7ZipExeFileLocation =  Get-7ZipExePackagedLocation

    # Package extraction directory
    $agentDirectory = $env:AGENT_HOMEDIRECTORY
    $SystemTempDirectory = "$agentDirectory\temp"
    $PackageExtractionDirectory = "$SystemTempDirectory\AzureRMWebDeploy"
    
    # Create alias for 7zip file
    set-alias sz $7ZipExeFileLocation

    # Extract content of package file
    $7ZipExtractionCommand = "sz x $PackageFile -o$PackageExtractionDirectory -y" 
    Invoke-Expression  $7ZipExtractionCommand | Out-Null
    
    if ($LASTEXITCODE -ne 0)
    {
        throw "An error occurred while unzipping [$PackageFile] to [$PackageExtractionDirectory]. 7Zip Exit Code was [$LASTEXITCODE]."
    }

    # Variable substitution in web.config files
    . .\VariableSubstituter.ps1 -WebAppFolderPath $PackageExtractionDirectory -ConfigFileRegex "Web.*Config"

    # Recompress extracted content after substituting variables

    $FinalPackageFile = "$SystemTempDirectory\$PackageFileName"
    $7ZipCompressionCommand = "sz a -tzip '$FinalPackageFile' '$PackageExtractionDirectory\*' -y"
    
    Invoke-Expression  $7ZipCompressionCommand | Out-Null

    if ($LASTEXITCODE -ne 0)
    {
        throw "An error occurred while compressing [$PackageExtractionDirectory ] to [$FinalPackageFile]. 7Zip Exit Code was [$LASTEXITCODE]."
    }

    Write-Verbose -Verbose "Package after variable substitution $FinalPackageFile "
    return $FinalPackageFile

}

function Get-RegistryValueIgnoreError
{
    param
    (
        [parameter(Mandatory = $true)]
        [Microsoft.Win32.RegistryHive]
        $RegistryHive,

        [parameter(Mandatory = $true)]
        [System.String]
        $Key,

        [parameter(Mandatory = $true)]
        [System.String]
        $Value,

        [parameter(Mandatory = $true)]
        [Microsoft.Win32.RegistryView]
        $RegistryView
    )

    try
    {
        $baseKey = [Microsoft.Win32.RegistryKey]::OpenBaseKey($RegistryHive, $RegistryView)
        $subKey =  $baseKey.OpenSubKey($Key)
        if($subKey -ne $null)
        {
            return $subKey.GetValue($Value)
        }
    }
    catch
    {
    }
    return $null
}

function Get-7ZipExeInstalledLocation
{
    
    # ToDo : Read this path location from registry
    $7ZipInstallRootRegKey = "SOFTWARE", "7-Zip" -join [System.IO.Path]::DirectorySeparatorChar
    $7ZipInstallRootPath = Get-RegistryValueIgnoreError LocalMachine "$7ZipInstallRootRegKey" "Path" Registry64
    if( $7ZipInstallRootPath -eq $null ){
        $7ZipInstallRootPath = Get-RegistryValueIgnoreError LocalMachine "$7ZipInstallRootRegKey" "Path" Registry32
    }

    if( $7ZipInstallRootPath -eq $null ){
        throw "7zip is not installed at your system.Please install 7zip"
    }

    $7ZipExeFileLocation = $7ZipInstallRootPath+"7z.exe"
    Write-Verbose "7zip installed in system at location $7ZipExeFileLocation" -Verbose

    if ( -not ( Test-Path -Path "$7ZipExeFileLocation" ) )
    {
        throw "7Zip.exe file at location $7ZipExeFileLocation doesn't exists."
    }

    return $7ZipExeFileLocation
}

function Get-7ZipExePackagedLocation
{
    
    $7ZipExeFileLocation = "7zip\7z.exe"

    return $7ZipExeFileLocation
}
