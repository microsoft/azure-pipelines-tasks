function Get-SinglePathOfType
{
    Param (
        [String]
        $Pattern,

        [ValidateSet("Leaf", "Container")]
        $PathType,

        [Switch]
        $Require
    )

    Write-Host (Get-VstsLocString -Key SearchingForPath -ArgumentList $Pattern)
    if ($Pattern)
    {
        if ($PathType -eq "Container")
        {
            $path = Find-VstsFiles -LegacyPattern $Pattern -IncludeDirectories
        }
        else
        {
            $path = Find-VstsFiles -LegacyPattern $Pattern
        }
    }
    else
    {
        $path = $null
    }

    if (@($path).Length -gt 1)
    {
        throw (Get-VstsLocString -Key ItemSearchMoreThanOneFound -ArgumentList $Pattern)
    }
    elseif ($path -eq $null -or @($path).Length -eq 0)
    {
        $noFileFoundMessage = Get-VstsLocString -Key ItemSearchNoFilesFound -ArgumentList $Pattern
        if ($Require)
        {
            throw $noFileFoundMessage
        }
        else
        {
            Write-Host $noFileFoundMessage
        }
    }
    else
    {
        Assert-VstsPath -LiteralPath $path -PathType $PathType
        Write-Host (Get-VstsLocString -Key FoundPath -ArgumentList $path)
    }

    return $path
}

function Read-XmlElementAsHashtable
{
    Param (
        [System.Xml.XmlElement]
        $Element
    )

    $hashtable = @{}
    if ($Element.Attributes)
    {
        $Element.Attributes |
            ForEach-Object {
            # Only boolean values are strongly-typed.  All other values are treated as strings.
            $boolVal = $null
            if ([bool]::TryParse($_.Value, [ref]$boolVal))
            {
                $hashtable[$_.Name] = $boolVal
            }
            else
            {
                $hashtable[$_.Name] = $_.Value
            }
        }
    }

    return $hashtable
}

function Read-PublishProfile
{
    Param (
        [String]
        $PublishProfileFile
    )

    $publishProfileXml = [Xml] (Get-Content -LiteralPath $PublishProfileFile)
    $publishProfileElement = $publishProfileXml.PublishProfile
    $publishProfile = @{}

    $publishProfile.UpgradeDeployment = Read-XmlElementAsHashtable $publishProfileElement.Item("UpgradeDeployment")
    $publishProfile.CopyPackageParameters = Read-XmlElementAsHashtable $publishProfileElement.Item("CopyPackageParameters")

    if ($publishProfileElement.Item("UpgradeDeployment"))
    {
        $publishProfile.UpgradeDeployment.Parameters = Read-XmlElementAsHashtable $publishProfileElement.Item("UpgradeDeployment").Item("Parameters")
        if ($publishProfile.UpgradeDeployment["Mode"])
        {
            $publishProfile.UpgradeDeployment.Parameters[$publishProfile.UpgradeDeployment["Mode"]] = $true
        }
    }

    $publishProfileFolder = (Split-Path -LiteralPath $PublishProfileFile)
    $publishProfile.ApplicationParameterFile = [System.IO.Path]::Combine($publishProfileFolder, $publishProfileElement.ApplicationParameterFile.Path)

    return $publishProfile
}

function Get-OverridenApplicationParameters
{
    Param (
        [String]
        $ApplicationManifestPath
    )

    $overrideParameters = @{}
    $applicationManifestXml = [Xml] (Get-Content -LiteralPath $ApplicationManifestPath)
    foreach ($param in $applicationManifestXml.ApplicationManifest.Parameters.Parameter)
    {
        $paramName = $param.Name
        $paramValue = Get-VstsTaskVariable -Name $paramName -ErrorAction Ignore
        if ($paramValue)
        {
            $overrideParameters.Add($paramName, $paramValue)
        }
    }

    return $overrideParameters
}

function Get-ApplicationManifestPath
{
    Param (
        [String]
        $ApplicationPackagePath
    )

    $appManifestName = "ApplicationManifest.xml"
    $localAppManifestPath = Join-Path $ApplicationPackagePath $appManifestName
    return $localAppManifestPath
}

function Get-VstsUpgradeParameters
{
    Param ()

    $parameters = @{}

    $upgradeMode = Get-VstsInput -Name upgradeMode -Require
    $parameters[$upgradeMode] = $true

    $upgradeReplicaSetCheckTimeoutSecValue = Get-VstsInput -Name "UpgradeReplicaSetCheckTimeoutSec"
    if (!$upgradeReplicaSetCheckTimeoutSecValue)
    {
        $upgradeReplicaSetCheckTimeoutSecValue = Get-VstsInput -Name "ReplicaQuorumTimeoutSec"
    }

    if ($upgradeReplicaSetCheckTimeoutSecValue)
    {
        $parameters["UpgradeReplicaSetCheckTimeoutSec"] = $upgradeReplicaSetCheckTimeoutSecValue
    }

    $parameterNames = @(
        "TimeoutSec",
        "ForceRestart"
    )

    if ($upgradeMode -eq "Monitored")
    {
        $parameterNames += @(
            "FailureAction",
            "HealthCheckRetryTimeoutSec",
            "HealthCheckWaitDurationSec",
            "HealthCheckStableDurationSec",
            "UpgradeDomainTimeoutSec",
            "ConsiderWarningAsError",
            "DefaultServiceTypeHealthPolicy",
            "MaxPercentUnhealthyDeployedApplications",
            "UpgradeTimeoutSec",
            "ServiceTypeHealthPolicyMap"
        )
    }

    foreach ($name in $parameterNames)
    {
        $value = Get-VstsInput -Name $name
        if ($value)
        {
            if ($value -eq "false")
            {
                $parameters[$name] = $false
            }
            elseif ($value -eq "true")
            {
                $parameters[$name] = $true
            }
            else
            {
                $parameters[$name] = $value
            }
        }
    }

    $parameters["Force"] = $true

    return $parameters
}