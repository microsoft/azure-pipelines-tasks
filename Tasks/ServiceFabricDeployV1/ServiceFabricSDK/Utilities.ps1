function Expand-ToFolder
{
    <#
    .SYNOPSIS
    Unzips the zip file to the specified folder.

    .PARAMETER From
    Source location to unzip

    .PARAMETER Name
    Folder name to expand the files to.
    #>

    [CmdletBinding()]
    Param
    (
        [String]
        $File,

        [String]
        $Destination
    )

    if (!(Test-Path -LiteralPath $File))
    {
        return
    }

    if (Test-Path -LiteralPath $Destination)
    {
        Remove-Item -LiteralPath $Destination -Recurse -ErrorAction Stop | Out-Null
    }

    New-Item $Destination -ItemType directory | Out-Null


    Write-Verbose -Message (Get-VstsLocString -Key SFSDK_UnzipPackage -ArgumentList @($File, $Destination))
    try
    {
        [System.Reflection.Assembly]::LoadWithPartialName("System.IO.Compression.FileSystem") | Out-Null
        [System.IO.Compression.ZipFile]::ExtractToDirectory("$File", "$Destination")
    }
    catch
    {
        Write-Error -Message (Get-VstsLocString -Key SFSDK_UnexpectedError -ArgumentList $_.Exception.Message)
    }
}

function Get-NamesFromApplicationManifest
{
    <#
    .SYNOPSIS
    Returns an object containing common information from the application manifest.

    .PARAMETER ApplicationManifestPath
    Path to the application manifest file.
    #>

    [CmdletBinding()]
    Param
    (
        [String]
        $ApplicationManifestPath
    )

    if (!(Test-Path -LiteralPath $ApplicationManifestPath))
    {
        throw (Get-VstsLocString -Key PathDoesNotExist -ArgumentList $ApplicationManifestPath)
    }


    $appXml = [xml] (Get-Content -LiteralPath $ApplicationManifestPath)
    if (!$appXml)
    {
        return
    }

    $appMan = $appXml.ApplicationManifest
    $FabricNamespace = 'fabric:'
    $appTypeSuffix = 'Type'

    $h = @{
        FabricNamespace        = $FabricNamespace;
        ApplicationTypeName    = $appMan.ApplicationTypeName;
        ApplicationTypeVersion = $appMan.ApplicationTypeVersion;
    }

    Write-Output (New-Object psobject -Property $h)
}

function Get-ImageStoreConnectionStringFromClusterManifest
{
    <#
    .SYNOPSIS
    Returns the value of the image store connection string from the cluster manifest.

    .PARAMETER ClusterManifest
    Contents of cluster manifest file.
    #>

    [CmdletBinding()]
    Param
    (
        [xml]
        $ClusterManifest
    )

    $managementSection = $ClusterManifest.ClusterManifest.FabricSettings.Section | ? { $_.Name -eq "Management" }
    return $managementSection.ChildNodes | ? { $_.Name -eq "ImageStoreConnectionString" } | Select-Object -Expand Value
}


function Get-ApplicationNameFromApplicationParameterFile
{
    <#
    .SYNOPSIS
    Returns Application Name from ApplicationParameter xml file.

    .PARAMETER ApplicationParameterFilePath
    Path to the application parameter file
    #>

    [CmdletBinding()]
    Param
    (
        [String]
        $ApplicationParameterFilePath
    )

    if (!(Test-Path -LiteralPath $ApplicationParameterFilePath))
    {
        $errMsg = (Get-VstsLocString -Key PathDoesNotExist -ArgumentList $ApplicationParameterFilePath)
        throw $errMsg
    }

    return ([xml] (Get-Content -LiteralPath $ApplicationParameterFilePath)).Application.Name
}


function Get-ApplicationParametersFromApplicationParameterFile
{
    <#
    .SYNOPSIS
    Reads ApplicationParameter xml file and returns HashTable containing ApplicationParameters.

    .PARAMETER ApplicationParameterFilePath
    Path to the application parameter file
    #>

    [CmdletBinding()]
    Param
    (
        [String]
        $ApplicationParameterFilePath
    )

    if (!(Test-Path -LiteralPath $ApplicationParameterFilePath))
    {
        throw (Get-VstsLocString -Key PathDoesNotExist -ArgumentList $ApplicationParameterFilePath)
    }

    $ParametersXml = ([xml] (Get-Content -LiteralPath $ApplicationParameterFilePath)).Application.Parameters

    $hash = @{}
    $ParametersXml.ChildNodes | foreach {
        if ($_.LocalName -eq 'Parameter')
        {
            $hash[$_.Name] = $_.Value
        }
    }

    return $hash
}

function Merge-HashTables
{
    <#
    .SYNOPSIS
    Merges 2 hashtables. Key, value pairs form HashTableNew are preserved if any duplciates are found between HashTableOld & HashTableNew.

    .PARAMETER HashTableOld
    First Hashtable.

    .PARAMETER HashTableNew
    Second Hashtable
    #>

    [CmdletBinding()]
    Param
    (
        [HashTable]
        $HashTableOld,

        [HashTable]
        $HashTableNew
    )

    $keys = $HashTableOld.getenumerator() | foreach-object {$_.key}
    $keys | foreach-object {
        $key = $_
        if ($HashTableNew.containskey($key))
        {
            $HashTableOld.remove($key)
        }
    }
    $HashTableNew = $HashTableOld + $HashTableNew
    return $HashTableNew
}

function Get-ServiceFabricApplicationAction
{
    Param (
        [string]
        $ApplicationTypeName,

        [string]
        $ApplicationName
    )

    $getApplicationParams = @{}
    if ($ApplicationTypeName)
    {
        $getApplicationParams['ApplicationTypeName'] = $ApplicationTypeName
    }

    if ($ApplicationName)
    {
        $getApplicationParams['ApplicationName'] = $ApplicationName
    }

    $global:operationId = $SF_Operations.GetApplication
    return Get-ServiceFabricApplication @getApplicationParams
}

function Get-ServiceFabricApplicationTypeAction
{
    Param (
        [string]
        $ApplicationTypeName
    )

    $global:operationId = $SF_Operations.GetApplicationType
    return Get-ServiceFabricApplicationType -ApplicationTypeName $ApplicationTypeName
}

function Get-ServiceFabricApplicationUpgradeAction
{
    Param (
        [string]
        $ApplicationName
    )

    $global:operationId = $SF_Operations.GetApplicationUpgradeStatus
    return Get-ServiceFabricApplicationUpgrade -ApplicationName $ApplicationName
}