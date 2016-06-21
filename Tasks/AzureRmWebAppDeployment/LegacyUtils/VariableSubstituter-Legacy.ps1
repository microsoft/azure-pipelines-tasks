Param(
    [string][Parameter(mandatory=$true)] 
    $WebAppFolderPath,
    [string][Parameter(mandatory=$true)] 
    $ConfigFileRegex
)

# Load modules
. $PSScriptRoot/XMLSubstituter-Legacy.ps1 -Force

# Defined supported MIME type
$ApplicationXmlMimeType = "application/xml"
$TextXmlMimeType = "application/xml"
$ConfigExtension = ".config"

function Get-MimeType()
{
    param(
        [string][Parameter(mandatory=$false)] $fileExtension
    )
 
    $mimeType = $null
    
    if ( [string]::IsNullOrEmpty($fileExtension) -eq $false )
    {
        $drive = Get-PSDrive HKCR -ErrorAction SilentlyContinue;
        if ( $null -eq $drive )
        {
            $drive = New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT
        }
        $fileExtensionProperty = (Get-ItemProperty HKCR:$fileExtension)
        if( $fileExtensionProperty -eq $null)
        {
            Write-Verbose "Unknown file extension : $fileExtension"
            return $null
        }
        $mimeType = $fileExtensionProperty."Content Type"
        Write-Verbose "Found MIME type $mimeType for file extension as : $fileExtension"
    }

    return $mimeType
}

# Find all configuration files
$webConfigFiles = Get-ChildItem -Path $WebAppFolderPath -Filter $ConfigFileRegex -Recurse -ErrorAction SilentlyContinue -Force

if( $webConfigFiles.Count -eq 0)
{
    Write-Verbose "File not found at location : $WebAppFolderPath with pattern $ConfigFileRegex"
    return
}

foreach( $file in $WebConfigFiles )
{
    
    # Get mime type of each file
    if( $ConfigExtension -eq $file.Extension ){
        $fileMimeType = $TextXmlMimeType
    }
    else
    {
        $fileMimeType = Get-MimeType -fileExtension $file.Extension
    }

    if( [string]::IsNullOrEmpty($fileMimeType) )
    {
        Write-Verbose "Unable to detect MIME type for file with $($file.Extension) extension"
        Continue
    }

    # Compare mime type of file and invoke corresponding variable substituter
    if( $fileMimeType -eq $ApplicationXmlMimeType -or $fileMimeType -eq $TextXmlMimeType )
    {
            
        $tags = @("appSettings","connectionStrings","configSections")
        Substitute-XMLAttributeValues -xmlFile $file.FullName -tags $tags

    }
    
}

