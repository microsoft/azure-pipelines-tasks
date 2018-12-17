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

    $global:operationId = $SF_Operations.GetApplication

    if(Test-OldSdk)
    {
        return Get-ServiceFabricApplicationActionOldSdk -ApplicationTypeName $ApplicationTypeName -ApplicationName $ApplicationName
    }

    $getApplicationParams = @{}
    if ($ApplicationTypeName)
    {
        $getApplicationParams['ApplicationTypeName'] = $ApplicationTypeName
    }

    if ($ApplicationName)
    {
        $getApplicationParams['ApplicationName'] = $ApplicationName
    }

    return Invoke-ActionWithDefaultRetries -Action { Get-ServiceFabricApplication @getApplicationParams } `
        -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingGetApplication)
}

function Get-ServiceFabricServiceTypeAction
{
    Param (
        [string]
        $ApplicationTypeName,

        [string]
        $ApplicationTypeVersion
    )

    $global:operationId = $SF_Operations.GetServiceType

    return Invoke-ActionWithDefaultRetries -Action { Get-ServiceFabricServiceType -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion } `
        -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingGetServiceType)
}

function Get-ServiceFabricServiceManifestAction
{
    Param (
        [string]
        $ApplicationTypeName,

        [string]
        $ApplicationTypeVersion,

        [string]
        $ServiceManifestName
    )

    $global:operationId = $SF_Operations.GetServiceManifest

    return Invoke-ActionWithDefaultRetries -Action { Get-ServiceFabricServiceManifest -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -ServiceManifestName $ServiceManifestName } `
        -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingGetServiceManifest)
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

    $upgradeStatusFetcher = {
        param(
            [object]$LastUpgradeStatus
        )
        $upgradeStatus = Get-ServiceFabricApplicationUpgrade -ApplicationName $ApplicationName
        Write-Host (Get-VstsLocString -Key SFSDK_CurrentUpgradeState) $upgradeStatus.UpgradeState

        $currentDomainWiseUpgradeStatus = Get-DomainUpgradeStatus -UpgradeDomainsStatus $upgradeStatus.UpgradeDomainsStatus
        $lastDomainWiseUpgradeStatus = ""
        if ($LastUpgradeStatus -ne $null)
        {
            $lastDomainWiseUpgradeStatus = Get-DomainUpgradeStatus -UpgradeDomainsStatus $LastUpgradeStatus.UpgradeDomainsStatus
        }

        if (($currentDomainWiseUpgradeStatus -ne $lastDomainWiseUpgradeStatus) -and ($currentDomainWiseUpgradeStatus -ne ""))
        {
            Write-Host (Get-VstsLocString -Key SFSDK_DomainUpgradeStatus) $currentDomainWiseUpgradeStatus
        }

        # unhealthy evaluations to be printed.
        if ($upgradeStatus.UnhealthyEvaluations -ne $null)
        {
            $currentUnhealthyEvaluation = Get-UnhealthyEvaluationMessage -UnhealthyEvaluations $upgradeStatus.UnhealthyEvaluations, -Indentation ""
            $lastUnhealthyEvaluation = ""
            if ($LastUpgradeStatus -ne $null)
            {
                $lastUnhealthyEvaluation = Get-UnhealthyEvaluationMessage -UnhealthyEvaluations $LastUpgradeStatus.UnhealthyEvaluations, -Indentation ""
            }

            if (($currentUnhealthyEvaluation -ne $lastUnhealthyEvaluation) -and ($currentUnhealthyEvaluation -ne ""))
            {
                Write-Host $currentUnhealthyEvaluation.Trim()
            }
        }

        return $upgradeStatus;
    }

    $upgradeStatusValidator = { param($upgradeStatus) return !($upgradeStatus.UpgradeState -eq "RollingBackCompleted" -or $upgradeStatus.UpgradeState -eq "RollingForwardCompleted") }

    $exceptionRetryEvaluator = {
        param($ex)

        if ($ex.GetType().FullName -eq "System.Fabric.FabricException")
        {
            if($ex.ErrorCode -eq "InvalidCredentials")
            {
                $clusterConnectionParameters = @{}
                $connectedServiceEndpoint = Get-VstsEndpoint -Name $serviceConnectionName -Require
                Connect-ServiceFabricClusterFromServiceEndpoint -ClusterConnectionParameters $clusterConnectionParameters -ConnectedServiceEndpoint $connectedServiceEndpoint
                return $true
            }
            return $false
        }
        return $true
    }

    try
    {
        $upgradeStatus = Invoke-ActionWithRetries -Action $upgradeStatusFetcher `
            -ResultRetryEvaluator $upgradeStatusValidator `
            -MaxTries 2147483647 `
            -RetryIntervalInSeconds 5 `
            -ExceptionRetryEvaluator $exceptionRetryEvaluator `
            -RetryableExceptions @("System.Fabric.FabricTransientException", "System.TimeoutException", "System.Fabric.FabricException")
    }
    catch
    {
        Trace-ServiceFabricApplicationHealth -ApplicationName $ApplicationName
        Trace-ServiceFabricClusterHealth
        throw
    }
    return $upgradeStatus
}

function Get-UnhealthyEvaluationMessage
{
    param(
        [object]$UnhealthyEvaluations,

        [string]$Indentation
    )

    if ($UnhealthyEvaluations -eq $null)
    {
        return ""
    }

    $unhealthyEvaluationsKind = ($UnhealthyEvaluations.kind | Out-String).Trim()
    $indentedErrorString = ""
    $indentedErrorString += $Indentation + $UnhealthyEvaluations.Description + "`n"
    foreach ($UnhealthyEvaluation in $UnhealthyEvaluations.UnhealthyEvaluations)
    {
        # see if indentation needs to be increased. based on the type of evaluation.
        $unhealthyEvaluationKind = ($UnhealthyEvaluation.kind | Out-String).Trim()
        $newIndentation = $Indentation
        if (!($unhealthyEvaluationsKind -eq ($unhealthyEvaluationKind + "s")))
        {
            $newIndentation += "`t"
        }

        $childUnhelathyEvaluations = Get-UnhealthyEvaluationMessage -UnhealthyEvaluations $UnhealthyEvaluation -Indentation $newIndentation
        if ($childUnhelathyEvaluations -ne "")
        {
            $indentedErrorString += $childUnhelathyEvaluations + "`n"
        }
    }

    if ($UnhealthyEvaluations.UnhealthyEvent -and $UnhealthyEvaluations.UnhealthyEvent.HealthInformation.Description)
    {
        $indentedErrorString += $Indentation + $UnhealthyEvaluations.UnhealthyEvent.HealthInformation.Description + "`n"
    }

    return $indentedErrorString
}

function Get-DomainUpgradeStatus
{
    param(
        [object]$UpgradeDomainsStatus
    )
    if ($UpgradeDomainsStatus -eq $null)
    {
        return ""
    }

    $upgradeDomainStatusString = ([String]($UpgradeDomainsStatus)).Trim()
    return $upgradeDomainStatusString
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
        $ApplicationTypeVersion,

        [int]
        $TimeoutSec
    )

    $global:operationId = $SF_Operations.RegisterApplicationType
    if(Test-OldSdk)
    {
        Register-ServiceFabricApplicationTypeActionOldSdk -RegisterParameters $RegisterParameters -TimeoutSec $TimeoutSec
        return
    }

    $RegisterParameters['Async'] = $true

    $registerAction = {
        Register-ServiceFabricApplicationType @RegisterParameters
        if (!$?)
        {
            throw (Get-VstsLocString -Key SFSDK_RegisterAppTypeFailed)
        }
    }

    $exceptionRetryEvaluator = {
        param($ex)
        # If app already created, don't retry
        if ($ex.GetType().FullName -eq "System.Fabric.FabricElementAlreadyExistsException")
        {
            return $false
        }

        return $true
    }

    try
    {
        Invoke-ActionWithDefaultRetries -Action $registerAction `
            -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingRegisterApplicationType) `
            -ExceptionRetryEvaluator $exceptionRetryEvaluator `
            -RetryableExceptions @("System.Fabric.FabricTransientException", "System.Fabric.FabricElementAlreadyExistsException", "System.TimeoutException")
    }
    catch
    {
        try
        {
            #In case of any failure we need to keep the cluster clean as much as possible
            Unregister-ServiceFabricApplicationTypeAction -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -TimeoutSec $TimeoutSec
        }
        catch
        {
            #This is just for best effort, else no need to take any action here
        }
        # print cluster health status if registering failed
        Trace-ServiceFabricClusterHealth
        throw
    }

    Wait-ServiceFabricApplicationTypeRegistrationStatus -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -TimeoutSec $TimeoutSec
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
    if(Test-OldSdk)
    {
        return Get-ServiceFabricApplicationTypeActionOldSdk -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion
    }

    $getApplicationTypeParams = @{
        'ApplicationTypeName' = $ApplicationTypeName
        'UsePaging' = $true
    }

    if ($ApplicationTypeVersion)
    {
        $getApplicationTypeParams['ApplicationTypeVersion'] = $ApplicationTypeVersion
    }

    $getAppTypeAction = { Get-ServiceFabricApplicationType @getApplicationTypeParams }
    return Invoke-ActionWithDefaultRetries -Action $getAppTypeAction `
        -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingGetApplicationType)
}

function Wait-ServiceFabricApplicationTypeRegistrationStatus
{
    Param (
        [string]
        $ApplicationTypeName,

        [string]
        $ApplicationTypeVersion,

        [int]
        $TimeoutSec
    )

    $global:operationId = $SF_Operations.GetApplicationType
    $getAppTypeAction = { Get-ServiceFabricApplicationTypeAction -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion }
    $getAppTypeRetryEvaluator = {
        param($appType)

        # If provisioning not started, retry register
        if(!$appType)
        {
            return $true
        }
        # if app type is provisioned, don't retry
        elseif($appType.Status -eq [System.Fabric.Query.ApplicationTypeStatus]::Available)
        {
            return $false
        }
        # if app type exist and if its status has not changed to a terminal one, do retry
        elseif(($appType.Status -eq [System.Fabric.Query.ApplicationTypeStatus]::Provisioning) -or ($appType.Status -eq [System.Fabric.Query.ApplicationTypeStatus]::Unprovisioning))
        {
            return $true
        }
        # if app type exist and if its status has changed to a terminal one, throw
        elseif(($appType.Status -ne [System.Fabric.Query.ApplicationTypeStatus]::Provisioning) -and ($appType.Status -ne [System.Fabric.Query.ApplicationTypeStatus]::Unprovisioning))
        {
            throw (Get-VstsLocString -Key SFSDK_RegisterAppTypeFailedWithStatus -ArgumentList @($appType.Status, $appType.StatusDetails))
        }
    }

    $MaxTries = 1200
    $RetryIntervalInSeconds = 3
    if($TimeoutSec)
    {
        $MaxTries = [int]($TimeoutSec/$RetryIntervalInSeconds)
    }

    return Invoke-ActionWithRetries -Action $getAppTypeAction `
        -ResultRetryEvaluator $getAppTypeRetryEvaluator `
        -MaxTries $MaxTries `
        -RetryIntervalInSeconds $RetryIntervalInSeconds `
        -RetryableExceptions @("System.Fabric.FabricTransientException", "System.TimeoutException") `
        -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingGetApplicationType)
}

function Wait-ServiceFabricApplicationTypeUnregistrationStatus
{
    Param (
        [string]
        $ApplicationTypeName,

        [string]
        $ApplicationTypeVersion,

        [int]
        $TimeoutSec
    )

    $global:operationId = $SF_Operations.GetApplicationType
    $getAppTypeAction = { Get-ServiceFabricApplicationTypeAction -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion }
    $getAppTypeRetryEvaluator = {
        param($appType)

        # If app type unprovisioned, don't retry
        if(!$appType)
        {
            return $false
        }
        # if app type exist and if its status has not changed to a terminal one, do retry
        elseif(($appType.Status -eq [System.Fabric.Query.ApplicationTypeStatus]::Provisioning) -or ($appType.Status -eq [System.Fabric.Query.ApplicationTypeStatus]::Unprovisioning))
        {
            return $true
        }
        # if app type exist and if its status has changed to a terminal one, throw
        elseif(($appType.Status -ne [System.Fabric.Query.ApplicationTypeStatus]::Provisioning) -and ($appType.Status -ne [System.Fabric.Query.ApplicationTypeStatus]::Unprovisioning))
        {
            throw (Get-VstsLocString -Key SFSDK_RegisterAppTypeFailedWithStatus -ArgumentList @($appType.Status, $appType.StatusDetails))
        }
    }

    $MaxTries = 1200
    $RetryIntervalInSeconds = 3
    if($TimeoutSec)
    {
        $MaxTries = [int]($TimeoutSec/$RetryIntervalInSeconds)
    }

    return Invoke-ActionWithRetries -Action $getAppTypeAction `
        -ResultRetryEvaluator $getAppTypeRetryEvaluator `
        -MaxTries $MaxTries `
        -RetryIntervalInSeconds $RetryIntervalInSeconds `
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

    if(Test-OldSdk)
    {
        Unregister-ServiceFabricApplicationTypeActionOldSdk -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -TimeoutSec $TimeoutSec
        return
    }

    $global:operationId = $SF_Operations.UnregisterApplicationType

    $unregisterAction = {
        Unregister-ServiceFabricApplicationType -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -Async -Force
        if (!$?)
        {
            throw (Get-VstsLocString -Key SFSDK_UnableToUnregisterAppType)
        }
    }

    try
    {
        Invoke-ActionWithDefaultRetries -Action $unregisterAction `
            -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingUnregisterApplicationType)
    }
    catch
    {
        # print cluster health status if unregistering failed
        Trace-ServiceFabricClusterHealth
        throw
    }

    Wait-ServiceFabricApplicationTypeUnregistrationStatus -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -TimeoutSec $TimeoutSec
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

        # If app already created, don't retry
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

function Test-OldSdk
{
    $sdkVersionString = (Get-SfSdkVersion)
    $sdkVersion = New-Object Version
    if ([Version]::TryParse($sdkVersionString, [ref]$sdkVersion))
    {
        $minVersion = New-Object -TypeName Version -ArgumentList '3.1.183.9494'
        if ($sdkVersion -ge $minVersion)
        {
            return $false
        }
    }

    return $true
}

function Register-ServiceFabricApplicationTypeActionOldSdk
{
    Param (
        [hashtable]
        $RegisterParameters,

        [int]
        $TimeoutSec
    )

    if ($TimeoutSec)
    {
        $RegisterParameters['TimeoutSec'] = $TimeoutSec
    }

    Register-ServiceFabricApplicationType @RegisterParameters
    if (!$?)
    {
        throw (Get-VstsLocString -Key SFSDK_RegisterAppTypeFailed)
    }
}

function Unregister-ServiceFabricApplicationTypeActionOldSdk
{
    Param(
        [string]
        $ApplicationTypeName,

        [string]
        $ApplicationTypeVersion,

        [int]
        $TimeoutSec
    )

    Unregister-ServiceFabricApplicationType -ApplicationTypeName $ApplicationTypeName -ApplicationTypeVersion $ApplicationTypeVersion -TimeoutSec $TimeoutSec -Force
    if (!$?)
    {
        throw (Get-VstsLocString -Key SFSDK_UnableToUnregisterAppType)
    }
}

function Get-ServiceFabricApplicationActionOldSdk
{
    Param (
        [string]
        $ApplicationTypeName,

        [string]
        $ApplicationName
    )

    $getApplicationParams = @{}

    if ($ApplicationName)
    {
        $getApplicationParams['ApplicationName'] = $ApplicationName
    }

    $apps = Invoke-ActionWithDefaultRetries -Action { Get-ServiceFabricApplication @getApplicationParams } `
        -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingGetApplication)
    if($ApplicationTypeName)
    {
        $apps = $apps | Where-Object { $_.ApplicationTypeName -eq $ApplicationTypeName }
    }
     return $apps
}

function Get-ServiceFabricApplicationTypeActionOldSdk
{
    Param (
        [string]
        $ApplicationTypeName,

        [string]
        $ApplicationTypeVersion
    )

    $getApplicationTypeParams = @{
        'ApplicationTypeName' = $ApplicationTypeName
    }

    $getAppTypeAction = { Get-ServiceFabricApplicationType @getApplicationTypeParams }
    $appTypes = Invoke-ActionWithDefaultRetries -Action $getAppTypeAction `
        -RetryMessage (Get-VstsLocString -Key SFSDK_RetryingGetApplicationType)

    if($ApplicationTypeVersion)
    {
        $appTypes = $appTypes | Where-Object { $_.ApplicationTypeVersion -eq $ApplicationTypeVersion }
    }

    return $appTypes
}