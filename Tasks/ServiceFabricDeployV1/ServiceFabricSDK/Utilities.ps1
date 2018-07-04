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

function Get-ServiceFabricApplicationUpgradeAction
{
    Param (
        [string]
        $ApplicationName
    )

    $global:operationId = $SF_Operations.GetApplicationUpgradeStatus
    $getUpgradeAction = { Get-ServiceFabricApplicationUpgrade -ApplicationName $ApplicationName }
    return Invoke-ActionWithDefaultRetries -Action $getUpgradeAction `
        -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingGetApplicationUpgrade)
}

function Wait-ServiceFabricApplicationUpgradeAction
{
    Param (
        [string]
        $ApplicationName
    )

    $global:operationId = $SF_Operations.WaitApplicationUpgradeStatus

    Write-Host (Get-VstsLocString -Key SFSDK_WaitingForUpgrade)
    $upgradeStatusFetcher = { Get-ServiceFabricApplicationUpgrade -ApplicationName $ApplicationName }
    $upgradeRetryEvaluator = { param($upgradeStatus) return ($upgradeStatus.UpgradeState -ne "RollingBackCompleted" -and $upgradeStatus.UpgradeState -ne "RollingForwardCompleted") }
    return Invoke-ActionWithRetries -Action $upgradeStatusFetcher `
        -ResultRetryEvaluator $upgradeRetryEvaluator `
        -MaxTries 2147483647 `
        -RetryIntervalInSeconds 3 `
        -RetryableExceptions @("System.Fabric.FabricTransientException", "System.TimeoutException") `
        -RetryMessage (Get-VstsLocString -Key SFSDK_WaitingForUpgrade)
}

function Copy-ServiceFabricApplicationPackageAction
{
    Param (
        [hashtable]
        $CopyParameters
    )

    $global:operationId = $SF_Operations.CopyApplicationPackage
    $copyAction = {
        Copy-ServiceFabricApplicationPackage @CopyParameters
        if (!$?)
        {
            throw (Get-VstsLocString -Key SFSDK_CopyingAppToImageStoreFailed)
        }
    }

    Invoke-ActionWithDefaultRetries -Action $copyAction `
        -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingCopyApplicationPackage)
}

function Register-ServiceFabricApplicationTypeAction
{
    Param (
        [hashtable]
        $RegisterParameters,

        [string]
        $ApplicationTypeName,

        [string]
        $ApplicationTypeVersion
    )

    $global:operationId = $SF_Operations.RegisterApplicationType
    $registerAction = {
        Register-ServiceFabricApplicationType @RegisterParameters
        if (!$?)
        {
            throw (Get-VstsLocString -Key SFSDK_RegisterAppTypeFailed)
        }
    }

    $exceptionRetryEvaluator = {
        param($ex)
        $appType = Get-ServiceFabricApplicationTypeAction -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion
        # If provisioning not started, retry register
        if (!$appType)
        {
            Write-Host (Get-VstsLocString -Key SFSDK_ApplicationTypeProvisioningNotStarted)
            return $true
        }

        # if provisioning started, wait for it to complete
        if (($appType.Status -eq [System.Fabric.Query.ApplicationTypeStatus]::Provisioning) -or ($appType.Status -eq [System.Fabric.Query.ApplicationTypeStatus]::Unprovisioning))
        {
            Write-Host (Get-VstsLocString -Key SFSDK_ApplicationTypeProvisioningStarted)
            $appType = Wait-ServiceFabricApplicationTypeTerminalStatus -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion
        }

        # if app type got unprovisioned, retry register
        if (!$appType)
        {
            Write-Host (Get-VstsLocString -Key SFSDK_ApplicationTypeUnprovisioned)
            return $true
        }

        # if app type is provisioned, bail out
        if ($appType.Status -eq [System.Fabric.Query.ApplicationTypeStatus]::Available)
        {
            return $false
        }

        # if provisioning failed, throw and don't retry
        throw (Get-VstsLocString -Key SFSDK_RegisterAppTypeFailedWithStatus -ArgumentList @($appType.Status, $appType.StatusDetails))
    }

    try
    {
        Invoke-ActionWithDefaultRetries -Action $registerAction `
            -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingRegisterApplicationType) `
            -ExceptionRetryEvaluator $exceptionRetryEvaluator
    }
    catch
    {
        # print cluster health status if registering failed
        Trace-ServiceFabricClusterHealth
        throw
    }
}

function Get-ServiceFabricApplicationTypeAction
{
    Param (
        [string]
        $ApplicationTypeName,

        [string]
        $ApplicationTypeVersion
    )

    $global:operationId = $SF_Operations.GetApplicationType
    $getApplicationTypeParams = @{
        'ApplicationTypeName' = $ApplicationTypeName
    }

    if ($ApplicationTypeVersion)
    {
        $getApplicationTypeParams['ApplicationTypeVersion'] = $ApplicationTypeVersion
    }

    $getAppTypeAction = { Get-ServiceFabricApplicationType @getApplicationTypeParams }
    return Invoke-ActionWithDefaultRetries -Action $getAppTypeAction `
        -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingGetApplicationType)
}

function Wait-ServiceFabricApplicationTypeTerminalStatus
{
    Param (
        [string]
        $ApplicationTypeName,

        [string]
        $ApplicationTypeVersion
    )

    $global:operationId = $SF_Operations.GetApplicationType
    $getAppTypeAction = { Get-ServiceFabricApplicationType -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion }
    $getAppTypeRetryEvaluator = {
        param($appType)
        # if app type does not exist (i.e it got unprovisioned) or if its status has changed to a terminal one, stop wait
        if ((!$appType) -or (($appType.Status -ne [System.Fabric.Query.ApplicationTypeStatus]::Provisioning) -and ($appType.Status -ne [System.Fabric.Query.ApplicationTypeStatus]::Unprovisioning)))
        {
            return $false
        }
        else
        {
            Write-Host (Get-VstsLocString -Key SFSDK_ApplicationTypeStatus -ArgumentList @($appType.Status, $appType.StatusDetails))
            return $true
        }
    }

    return Invoke-ActionWithRetries -Action $getAppTypeAction `
        -ResultRetryEvaluator $getAppTypeRetryEvaluator `
        -MaxTries 86400 `
        -RetryIntervalInSeconds 10 `
        -RetryableExceptions @("System.Fabric.FabricTransientException", "System.TimeoutException") `
        -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingGetApplicationType)
}

function Unregister-ServiceFabricApplicationTypeAction
{
    Param(
        [string]
        $ApplicationTypeName,

        [string]
        $ApplicationTypeVersion,

        [int]
        $TimeoutSec
    )

    $global:operationId = $SF_Operations.UnregisterApplicationType

    $unregisterAction = {
        Unregister-ServiceFabricApplicationType -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -Force -TimeoutSec $TimeoutSec
        if (!$?)
        {
            throw (Get-VstsLocString -Key SFSDK_UnableToUnregisterAppType)
        }
    }

    $exceptionRetryEvaluator = {
        param($ex)
        $appType = Get-ServiceFabricApplicationTypeAction -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion
        # If app type already unprovisioned, don't retry
        if (!$appType)
        {
            return $false
        }

        # if unprovisioning started, wait for it to complete
        if (($appType.Status -eq [System.Fabric.Query.ApplicationTypeStatus]::Provisioning) -or ($appType.Status -eq [System.Fabric.Query.ApplicationTypeStatus]::Unprovisioning))
        {
            Write-Host (Get-VstsLocString -Key SFSDK_ApplicationTypeUnprovisioningStarted)
            $appType = Wait-ServiceFabricApplicationTypeTerminalStatus -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion
        }

        # if app type got unprovisioned, don't retry
        if (!$appType)
        {
            return $false
        }

        # if app type is still provisioned, retry unregister
        if ($appType.Status -eq [System.Fabric.Query.ApplicationTypeStatus]::Available)
        {
            return $true
        }

        # if unprovisioning failed, throw and don't retry
        throw (Get-VstsLocString -Key SFSDK_UnregisterAppTypeFailedWithStatus -ArgumentList @($appType.Status, $appType.StatusDetails))
    }

    try
    {
        Invoke-ActionWithDefaultRetries -Action $unregisterAction `
            -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingUnregisterApplicationType) `
            -ExceptionRetryEvaluator $exceptionRetryEvaluator
    }
    catch
    {
        # print cluster health status if unregistering failed
        Trace-ServiceFabricClusterHealth
        throw
    }
}

function Remove-ServiceFabricApplicationAction
{
    Param(
        [string]
        $ApplicationName
    )

    $global:operationId = $SF_Operations.RemoveApplication

    $removeAction = { Remove-ServiceFabricApplication -ApplicationName $ApplicationName -Force }
    $exceptionRetryEvaluator = {
        param($ex)

        # If app already removed, don't retry
        if ($ex.GetType().FullName -eq "System.Fabric.FabricElementNotFoundException")
        {
            return $false
        }

        return $true
    }

    try
    {
        Invoke-ActionWithDefaultRetries -Action $removeAction `
            -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingRemoveApplication) `
            -ExceptionRetryEvaluator $exceptionRetryEvaluator `
            -RetryableExceptions @("System.Fabric.FabricTransientException", "System.Fabric.FabricElementNotFoundException", "System.TimeoutException")
    }
    catch [System.TimeoutException]
    {
        Write-Host (Get-VstsLocString -Key SFSDK_PerformingForceRemoveOnTimeout -ArgumentList $ApplicationName)
        $removeAction = { Remove-ServiceFabricApplication -ApplicationName $ApplicationName -Force -ForceRemove }
        Invoke-ActionWithDefaultRetries -Action $removeAction `
            -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingRemoveApplication) `
            -ExceptionRetryEvaluator $exceptionRetryEvaluator `
            -RetryableExceptions @("System.Fabric.FabricTransientException", "System.Fabric.FabricElementNotFoundException")
    }
}

function New-ServiceFabricApplicationAction
{
    Param (
        [string]
        $ApplicationName,

        [string]
        $ApplicationTypeName,

        [string]
        $ApplicationTypeVersion,

        [hashtable]
        $ApplicationParameter
    )

    $global:operationId = $SF_Operations.CreateNewApplication
    $createAction = { New-ServiceFabricApplication -ApplicationName $ApplicationName -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -ApplicationParameter $ApplicationParameter }
    $exceptionRetryEvaluator = {
        param($ex)

        # If app already creted, don't retry
        if ($ex.GetType().FullName -eq "System.Fabric.FabricElementAlreadyExistsException")
        {
            return $false
        }

        return $true
    }

    try
    {
        Invoke-ActionWithDefaultRetries -Action $createAction `
            -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingCreateApplication) `
            -ExceptionRetryEvaluator $exceptionRetryEvaluator `
            -RetryableExceptions @("System.Fabric.FabricTransientException", "System.Fabric.FabricElementAlreadyExistsException", "System.TimeoutException")
    }
    catch [System.TimeoutException]
    {
        Write-Host (Get-VstsLocString -Key SFSDK_CreateApplicationFailed)
        # print application health status if create did not succeed
        Trace-ServiceFabricApplicationHealth -ApplicationName $ApplicationName
        throw
    }
}

function Start-ServiceFabricApplicationUpgradeAction
{
    Param (
        [hashtable]
        $UpgradeParameters
    )

    $global:operationId = $SF_Operations.StartApplicationUpgrade
    $startAction = { Start-ServiceFabricApplicationUpgrade @UpgradeParameters }
    $exceptionRetryEvaluator = {
        param($ex)

        # If upgrade already started, don't retry
        $upgradeStatus = Get-ServiceFabricApplicationUpgradeAction -ApplicationName $($UpgradeParameters["ApplicationName"])
        if ($upgradeStatus -and ($upgradeStatus.UpgradeState -ne "RollingBackCompleted" -and $upgradeStatus.UpgradeState -ne "RollingForwardCompleted"))
        {
            return $false
        }

        return $true
    }

    try
    {
        Invoke-ActionWithDefaultRetries -Action $startAction `
            -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingUpgradeApplication) `
            -ExceptionRetryEvaluator $exceptionRetryEvaluator `
            -RetryableExceptions @("System.Fabric.FabricTransientException", "System.TimeoutException")
    }
    catch
    {
        # print application health status if starting upgrade did not succeed
        Trace-ServiceFabricApplicationHealth -ApplicationName $($UpgradeParameters["ApplicationName"])
        throw
    }
}

function Test-ServiceFabricClusterConnectionAction
{
    try
    {
        $global:operationId = $SF_Operations.TestClusterConnection
        $testAction = { [void](Test-ServiceFabricClusterConnection) }
        Invoke-ActionWithDefaultRetries -Action $testAction `
            -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingTestClusterConnection) `
            -RetryableExceptions @("System.Fabric.FabricTransientException", "System.TimeoutException")
    }
    catch
    {
        Write-Warning (Get-VstsLocString -Key SFSDK_UnableToVerifyClusterConnection)
        throw
    }
}

function Test-ServiceFabricApplicationPackageAction
{
    Param (
        [string]
        $AppPkgPath,

        [string]
        $ImageStoreConnectionString
    )

    $global:operationId = $SF_Operations.TestApplicationPackage
    $testAction = { Test-ServiceFabricApplicationPackage -ApplicationPackagePath $AppPkgPath -ImageStoreConnectionString $ImageStoreConnectionString }
    return Invoke-ActionWithDefaultRetries -Action $testAction `
        -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingTestAppPackage) `
        -RetryableExceptions @("System.Fabric.FabricTransientException", "System.TimeoutException")
}

function Get-ServiceFabricClusterManifestAction
{
    $global:operationId = $SF_Operations.GetClusterManifest
    $manifestAction = { Get-ServiceFabricClusterManifest }
    return Invoke-ActionWithDefaultRetries -Action $manifestAction `
        -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingGetClusterManifest) `
        -RetryableExceptions @("System.Fabric.FabricTransientException", "System.TimeoutException")
}

function Remove-ServiceFabricApplicationPackageAction
{
    Param (
        [string]
        $ApplicationPackagePathInImageStore,

        [string]
        $ImageStoreConnectionString
    )

    $global:operationId = $SF_Operations.RemoveApplicationPackage
    $removeAction = { Remove-ServiceFabricApplicationPackage -ApplicationPackagePathInImageStore $ApplicationPackagePathInImageStore -ImageStoreConnectionString $ImageStoreConnectionString }
    Invoke-ActionWithDefaultRetries -Action $removeAction `
        -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingRemoveApplicationPackage) `
        -RetryableExceptions @("System.Fabric.FabricTransientException", "System.TimeoutException")
}

function Trace-ServiceFabricClusterHealth
{
    try
    {
        Write-Host (Get-VstsLocString -Key SFSDK_ClusterHealth)
        Get-ServiceFabricClusterHealth
    }
    catch
    {}
}

function Trace-ServiceFabricApplicationHealth
{
    Param (
        [string]
        $ApplicationName
    )

    try
    {
        Write-Host (Get-VstsLocString -Key SFSDK_ApplicationHealth)
        Get-ServiceFabricApplicationHealth -ApplicationName $ApplicationName
    }
    catch
    {
        if ($_.Exception.Message -eq "Entity not found in Health Store.")
        {
            Trace-ServiceFabricClusterHealth
        }
    }
}

function Invoke-ActionWithDefaultRetries
{
    Param (
        [scriptblock]
        $Action,

        [string]
        $RetryMessage,

        [scriptblock]
        $ExceptionRetryEvaluator,

        [string[]]
        $RetryableExceptions
    )

    $parameters = @{
        Action                 = $Action
        MaxTries               = 3;
        RetryIntervalInSeconds = 10;
        RetryableExceptions    = @("System.Fabric.FabricTransientException", "System.TimeoutException");
        RetryMessage           = $RetryMessage;
    }

    if ($RetryableExceptions)
    {
        $parameters['RetryableExceptions'] = $RetryableExceptions
    }

    if ($ExceptionRetryEvaluator)
    {
        $parameters['ExceptionRetryEvaluator'] = $ExceptionRetryEvaluator
    }

    Invoke-ActionWithRetries @parameters
}