Param(
  [Parameter(mandatory=$true)][string]$webAppFolderPath,
  [Parameter(mandatory=$true)][string]$ConfigFileRegex
)

# define mime supported mime type
$ApplicationXMLMimeType = "application/xml" 

function Get-MimeType()
{
    param($extension = $null);
 
    $mimeType = $null;
    
    if ( $null -ne $extension )
    {
        $drive = Get-PSDrive HKCR -ErrorAction SilentlyContinue;
        if ( $null -eq $drive )
        {
            $drive = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT
        }
        $mimeType = (Get-ItemProperty HKCR:$extension)."Content Type";
    }
    $mimeType;
}


# getting variables defined in environment
$definedVariables = Get-ChildItem Env:

# Find all configuration files in extracted path of webapp
$webConfigFiles = Get-ChildItem -Path $WebAppFolderPath -Filter $ConfigFileRegex -Recurse -ErrorAction SilentlyContinue -Force

foreach( $file in $WebConfigFiles )
{
    # Get mime type of each file
    $fileMimeType = Get-MimeType -extension $file.Extension

    foreach($variable in $definedVariables){

        # Compare mime type of file and invoke corresponding variable substituter
        if( $fileMimeType -eq $ApplicationXMLMimeType ){

            .\XMLSubstituter.ps1 -xmlFile $file.FullName -tag "appSettings" -conditionalAttributeKey "key" -conditionalAttributeValue "$($variable.Name)" -targetKey "value" -targetValue "$($variable.Value)"
            .\XMLSubstituter.ps1 -xmlFile $file.FullName -tag "MyConnectionString"  -targetKey "$($variable.Name)" -targetValue "$($variable.Value)" 
        
        }
    }
}


